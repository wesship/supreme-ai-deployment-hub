-- Hermes adaptive governance production-compatibility overrides.
-- Keeps historical migrations immutable while aligning their RPCs with the
-- canonical production hermes_tasks schema (no per-task user_id column).
-- SECURITY DEFINER functions pin an empty search_path and remain service-role-only.

-- Atomic service-role-only transitions. Both state and audit commit in one transaction.
create or replace function public.hermes_decide_adaptive_change_request(
  p_request_id uuid,
  p_user_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.hermes_adaptive_change_requests%rowtype;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'invalid adaptive decision';
  end if;
  if char_length(coalesce(p_rationale,'')) < 3 then
    raise exception 'review rationale is required';
  end if;

  update public.hermes_adaptive_change_requests
     set status = p_decision,
         reviewer_id = p_actor_id,
         review_rationale = p_rationale,
         reviewed_at = now(),
         updated_at = now()
   where id = p_request_id
     and user_id = p_user_id
     and status = 'pending_review'
  returning * into v_row;

  if not found then
    raise exception 'adaptive change request is not pending review';
  end if;

  insert into public.hermes_adaptive_change_audit(
    user_id, change_request_id, actor_id, event_type, event_data
  ) values (
    p_user_id,
    p_request_id,
    p_actor_id,
    'change_request.' || p_decision,
    jsonb_build_object('rationale', p_rationale)
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.hermes_decide_adaptive_change_request(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.hermes_decide_adaptive_change_request(uuid,uuid,uuid,text,text) to service_role;


create or replace function public.hermes_queue_adaptive_canary(
  p_request_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hermes_adaptive_change_requests%rowtype;
  v_task_id uuid;
begin
  select *
    into v_request
    from public.hermes_adaptive_change_requests
   where id = p_request_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'adaptive change request not found';
  end if;

  if v_request.status = 'canary_queued' and v_request.canary_task_id is not null then
    return jsonb_build_object(
      'status','canary_queued',
      'task_id',v_request.canary_task_id,
      'request_id',p_request_id
    );
  end if;

  if v_request.status <> 'approved' then
    raise exception 'only approved adaptive change requests may queue a canary';
  end if;

  insert into public.hermes_tasks(
    title,
    description,
    task_type,
    kind,
    status,
    priority,
    source,
    retry_count,
    agent_name,
    input_data,
    payload
  ) values (
    'Adaptive canary: ' || v_request.target,
    'Governed evaluation-only canary. This task must not apply production config.',
    'adaptive_canary',
    'adaptive.canary',
    'PENDING',
    2,
    'knowledge_graph_change_request',
    0,
    'TARS',
    jsonb_build_object(
      'change_request_id', p_request_id,
      'proposal_id', v_request.proposal_id,
      'category', v_request.category,
      'target', v_request.target,
      'evidence_hash', v_request.evidence_hash,
      'proposed_change', v_request.proposed_change,
      'guardrail', v_request.guardrail,
      'rollback_plan', v_request.rollback_plan,
      'mode', 'evaluation_only',
      'apply_production_change', false
    ),
    jsonb_build_object(
      'change_request_id', p_request_id,
      'mode', 'evaluation_only',
      'apply_production_change', false
    )
  )
  returning id into v_task_id;

  update public.hermes_adaptive_change_requests
     set status = 'canary_queued',
         canary_task_id = v_task_id,
         updated_at = now()
   where id = p_request_id;

  insert into public.hermes_adaptive_change_audit(
    user_id, change_request_id, actor_id, event_type, event_data
  ) values (
    p_user_id,
    p_request_id,
    p_actor_id,
    'change_request.canary_queued',
    jsonb_build_object('task_id',v_task_id,'agent_name','TARS','mode','evaluation_only')
  );

  return jsonb_build_object(
    'status','canary_queued',
    'task_id',v_task_id,
    'request_id',p_request_id
  );
end;
$$;

revoke all on function public.hermes_queue_adaptive_canary(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.hermes_queue_adaptive_canary(uuid,uuid,uuid) to service_role;


drop function if exists public.hermes_certify_adaptive_canary(uuid,uuid,uuid,jsonb,jsonb);

create or replace function public.hermes_certify_adaptive_canary(
  p_request_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hermes_adaptive_change_requests%rowtype;
  v_task public.hermes_tasks%rowtype;
  v_baseline jsonb;
  v_candidate jsonb;
  v_cert_id uuid;
  v_decision text;
  v_reason text;
  v_success_base numeric;
  v_success_cand numeric;
  v_error_base numeric;
  v_error_cand numeric;
  v_latency_base numeric;
  v_latency_cand numeric;
  v_cost_base numeric;
  v_cost_cand numeric;
begin
  select * into v_request
  from public.hermes_adaptive_change_requests
  where id=p_request_id and user_id=p_user_id
  for update;

  if not found then raise exception 'adaptive change request not found'; end if;
  if v_request.status <> 'canary_queued' then raise exception 'canary is not eligible for certification'; end if;
  if v_request.canary_task_id is null then raise exception 'canary task missing'; end if;

  select * into v_task
  from public.hermes_tasks
  where id=v_request.canary_task_id
  for update;

  if not found then raise exception 'linked canary task not found'; end if;
  if v_task.status <> 'COMPLETED' then
    raise exception 'linked canary task must be completed before certification';
  end if;
  if coalesce(v_task.task_type,'') <> 'adaptive_canary' or coalesce(v_task.kind,'') <> 'adaptive.canary' then
    raise exception 'linked task is not an adaptive canary';
  end if;

  v_baseline := v_request.evidence->'baseline_metrics';
  v_candidate := v_task.output_data #> '{dispatch_result,output,certification_metrics}';

  if jsonb_typeof(v_baseline) <> 'object' then
    raise exception 'persisted baseline metrics are missing';
  end if;
  if jsonb_typeof(v_candidate) <> 'object' then
    raise exception 'completed canary did not persist certification metrics';
  end if;
  if coalesce((v_candidate->>'cost_measured')::boolean,false) is not true then
    raise exception 'completed canary lacks measured cost evidence';
  end if;

  if v_baseline->>'success_rate' is null
     or v_baseline->>'error_rate' is null
     or v_baseline->>'latency_ms' is null
     or v_baseline->>'cost_usd' is null
     or v_candidate->>'success_rate' is null
     or v_candidate->>'error_rate' is null
     or v_candidate->>'latency_ms' is null
     or v_candidate->>'cost_usd' is null then
    raise exception 'baseline and candidate metrics must include success, error, latency, and cost';
  end if;

  v_success_base := (v_baseline->>'success_rate')::numeric;
  v_success_cand := (v_candidate->>'success_rate')::numeric;
  v_error_base := (v_baseline->>'error_rate')::numeric;
  v_error_cand := (v_candidate->>'error_rate')::numeric;
  v_latency_base := greatest((v_baseline->>'latency_ms')::numeric,1);
  v_latency_cand := (v_candidate->>'latency_ms')::numeric;
  v_cost_base := greatest((v_baseline->>'cost_usd')::numeric,0.000001);
  v_cost_cand := (v_candidate->>'cost_usd')::numeric;

  if v_success_cand + 0.02 < v_success_base
     or v_error_cand > v_error_base + 0.02
     or v_latency_cand > v_latency_base * 1.20
     or v_cost_cand > v_cost_base * 1.20 then
    v_decision := 'fail';
    v_reason := 'Candidate exceeded one or more regression limits; current production policy retained.';
  else
    v_decision := 'pass';
    v_reason := 'Completed canary remained within certification regression limits.';
  end if;

  insert into public.hermes_adaptive_canary_certifications(
    user_id,change_request_id,canary_task_id,baseline,candidate,deltas,decision,decision_reason,rollback_state
  ) values (
    p_user_id,p_request_id,v_request.canary_task_id,v_baseline,v_candidate,
    jsonb_build_object(
      'success_rate',v_success_cand-v_success_base,
      'error_rate',v_error_cand-v_error_base,
      'latency_ms',v_latency_cand-v_latency_base,
      'cost_usd',v_cost_cand-v_cost_base
    ),
    v_decision,v_reason,
    case when v_decision='fail' then 'production_retained' else 'not_required' end
  )
  returning id into v_cert_id;

  update public.hermes_adaptive_change_requests
  set status=case when v_decision='pass' then 'canary_completed' else 'canary_failed' end,
      updated_at=now()
  where id=p_request_id;

  insert into public.hermes_adaptive_change_audit(
    user_id,change_request_id,actor_id,event_type,event_data
  ) values (
    p_user_id,p_request_id,p_actor_id,
    case when v_decision='pass' then 'canary.certified_pass' else 'canary.certified_fail' end,
    jsonb_build_object(
      'certification_id',v_cert_id,
      'decision',v_decision,
      'reason',v_reason,
      'canary_task_id',v_request.canary_task_id
    )
  );

  if v_decision='pass' then
    insert into public.hermes_adaptive_promotion_candidates(
      user_id,change_request_id,certification_id,proposed_change,evidence_hash
    ) values (
      p_user_id,p_request_id,v_cert_id,v_request.proposed_change,v_request.evidence_hash
    );
  else
    insert into public.hermes_adaptive_change_audit(
      user_id,change_request_id,actor_id,event_type,event_data
    ) values (
      p_user_id,p_request_id,p_actor_id,'canary.rollback_enforced',
      jsonb_build_object('mode','production_retained','rollback_plan',v_request.rollback_plan)
    );
  end if;

  return jsonb_build_object(
    'decision',v_decision,
    'certification_id',v_cert_id,
    'reason',v_reason,
    'canary_task_id',v_request.canary_task_id,
    'promotion_candidate_created',(v_decision='pass')
  );
end;
$$;

revoke all on function public.hermes_certify_adaptive_canary(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hermes_certify_adaptive_canary(uuid,uuid,uuid) to service_role;


create or replace function public.hermes_review_adaptive_promotion(
  p_candidate_id uuid,
  p_user_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.hermes_adaptive_promotion_candidates%rowtype;
  v_review_id uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid promotion decision'; end if;
  if char_length(btrim(coalesce(p_rationale,''))) < 3 then raise exception 'promotion rationale required'; end if;

  select * into v_candidate
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id and user_id=p_user_id
  for update;

  if not found then raise exception 'promotion candidate not found'; end if;
  if v_candidate.status <> 'pending_promotion_review' then raise exception 'promotion candidate already reviewed'; end if;

  insert into public.hermes_adaptive_promotion_reviews(
    user_id,promotion_candidate_id,reviewer_id,decision,rationale
  ) values (
    p_user_id,p_candidate_id,p_reviewer_id,p_decision,p_rationale
  ) returning id into v_review_id;

  update public.hermes_adaptive_promotion_candidates
  set status=p_decision
  where id=p_candidate_id;

  insert into public.hermes_adaptive_change_audit(
    user_id,change_request_id,actor_id,event_type,event_data
  )
  select p_user_id,change_request_id,p_reviewer_id,
         'promotion.' || p_decision,
         jsonb_build_object('promotion_candidate_id',p_candidate_id,'review_id',v_review_id,'rationale',p_rationale)
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id;

  return jsonb_build_object('candidate_id',p_candidate_id,'review_id',v_review_id,'decision',p_decision);
end;
$$;

revoke all on function public.hermes_review_adaptive_promotion(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hermes_review_adaptive_promotion(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.hermes_validate_adaptive_rollout(
  p_candidate_id uuid,
  p_user_id uuid,
  p_executor_id uuid,
  p_environment text,
  p_authorization_hash text,
  p_pre_change jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.hermes_adaptive_promotion_candidates%rowtype;
  v_review public.hermes_adaptive_promotion_reviews%rowtype;
  v_rollout_id uuid;
begin
  if p_environment not in ('staging','production') then raise exception 'invalid rollout environment'; end if;
  if p_environment='production' and coalesce(p_authorization_hash,'')='' then
    raise exception 'explicit production authorization required';
  end if;

  select * into v_candidate
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id and user_id=p_user_id
  for update;

  if not found then raise exception 'promotion candidate not found'; end if;
  if v_candidate.status <> 'approved' then raise exception 'approved promotion candidate required'; end if;

  select * into v_review
  from public.hermes_adaptive_promotion_reviews
  where promotion_candidate_id=p_candidate_id and decision='approved'
  limit 1;

  if not found then raise exception 'approved promotion review required'; end if;

  insert into public.hermes_adaptive_rollouts(
    user_id,promotion_candidate_id,promotion_review_id,executor_id,environment,
    authorization_token_hash,pre_change_config,approved_delta,post_change_config,rollback_config,
    status,runtime_changed
  ) values (
    p_user_id,p_candidate_id,v_review.id,p_executor_id,p_environment,
    p_authorization_hash,p_pre_change,v_candidate.proposed_change,
    p_pre_change || jsonb_build_object('approved_delta',v_candidate.proposed_change,'effective_runtime_changed',false),
    p_pre_change,'validated',false
  )
  on conflict (promotion_candidate_id, environment) do update
    set promotion_review_id = excluded.promotion_review_id,
        executor_id = excluded.executor_id,
        authorization_token_hash = excluded.authorization_token_hash,
        pre_change_config = excluded.pre_change_config,
        approved_delta = excluded.approved_delta,
        post_change_config = excluded.post_change_config,
        rollback_config = excluded.rollback_config,
        status = 'validated',
        runtime_changed = false,
        deployment_evidence = '{}'::jsonb,
        updated_at = now()
  returning id into v_rollout_id;

  insert into public.hermes_adaptive_change_audit(
    user_id,change_request_id,actor_id,event_type,event_data
  )
  select p_user_id,change_request_id,p_executor_id,'promotion.rollout_validated',
         jsonb_build_object('promotion_candidate_id',p_candidate_id,'rollout_id',v_rollout_id,'environment',p_environment,'runtime_changed',false)
  from public.hermes_adaptive_promotion_candidates
  where id=p_candidate_id;

  return jsonb_build_object(
    'status','rollout_validated',
    'rollout_id',v_rollout_id,
    'runtime_changed',false,
    'production_applied',false,
    'rollback_ready',true
  );
end;
$$;

revoke all on function public.hermes_validate_adaptive_rollout(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hermes_validate_adaptive_rollout(uuid,uuid,uuid,text,text,jsonb) to service_role;

