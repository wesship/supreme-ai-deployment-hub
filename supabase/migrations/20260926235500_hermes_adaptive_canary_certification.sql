create table if not exists public.hermes_adaptive_canary_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  change_request_id uuid not null references public.hermes_adaptive_change_requests(id) on delete cascade,
  canary_task_id uuid not null references public.hermes_tasks(id) on delete restrict,
  baseline jsonb not null,
  candidate jsonb not null,
  deltas jsonb not null,
  decision text not null check (decision in ('pass','fail')),
  decision_reason text not null,
  rollback_state text not null check (rollback_state in ('not_required','production_retained')),
  created_at timestamptz not null default now(),
  unique(change_request_id)
);

alter table public.hermes_adaptive_canary_certifications enable row level security;
revoke all on public.hermes_adaptive_canary_certifications from anon, authenticated;
grant select on public.hermes_adaptive_canary_certifications to authenticated;
grant all on public.hermes_adaptive_canary_certifications to service_role;
create policy "owners read adaptive canary certifications"
on public.hermes_adaptive_canary_certifications for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.hermes_adaptive_promotion_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  change_request_id uuid not null unique references public.hermes_adaptive_change_requests(id) on delete cascade,
  certification_id uuid not null unique references public.hermes_adaptive_canary_certifications(id) on delete restrict,
  proposed_change jsonb not null,
  evidence_hash text not null,
  status text not null default 'pending_promotion_review'
    check (status in ('pending_promotion_review','approved','rejected','promoted')),
  created_at timestamptz not null default now()
);

alter table public.hermes_adaptive_promotion_candidates enable row level security;
revoke all on public.hermes_adaptive_promotion_candidates from anon, authenticated;
grant select on public.hermes_adaptive_promotion_candidates to authenticated;
grant all on public.hermes_adaptive_promotion_candidates to service_role;
create policy "owners read adaptive promotion candidates"
on public.hermes_adaptive_promotion_candidates for select to authenticated
using ((select auth.uid()) = user_id);

drop function if exists public.hermes_certify_adaptive_canary(uuid,uuid,uuid,jsonb,jsonb);

create or replace function public.hermes_certify_adaptive_canary(
  p_request_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  where id=v_request.canary_task_id and user_id=p_user_id
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
