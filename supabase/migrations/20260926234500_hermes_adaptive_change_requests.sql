-- Governed Hermes adaptive recommendation change requests.
-- Recommendations remain advisory until a human decision is recorded.
-- Approved requests may queue a canary task, but never apply production config directly.

create table if not exists public.hermes_adaptive_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  proposal_id text not null,
  category text not null check (category in ('routing','agent','tool','concurrency','workflow')),
  target text not null,
  severity text not null check (severity in ('info','warning','critical')),
  risk_classification text not null check (risk_classification in ('low','medium','high','critical')),
  evidence jsonb not null default '{}'::jsonb,
  evidence_hash text not null,
  proposed_change jsonb not null default '{}'::jsonb,
  guardrail text not null,
  rollback_plan text not null check (char_length(rollback_plan) between 3 and 4000),
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','canary_queued','canary_completed','canary_failed')),
  reviewer_id uuid,
  review_rationale text,
  reviewed_at timestamptz,
  canary_task_id uuid references public.hermes_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, proposal_id, evidence_hash)
);

create index if not exists hermes_adaptive_change_requests_user_created_idx
  on public.hermes_adaptive_change_requests(user_id, created_at desc);
create index if not exists hermes_adaptive_change_requests_status_idx
  on public.hermes_adaptive_change_requests(status);

alter table public.hermes_adaptive_change_requests enable row level security;
revoke all on public.hermes_adaptive_change_requests from anon;
revoke all on public.hermes_adaptive_change_requests from authenticated;
grant select on public.hermes_adaptive_change_requests to authenticated;
grant all on public.hermes_adaptive_change_requests to service_role;

drop policy if exists "owners read hermes adaptive change requests"
  on public.hermes_adaptive_change_requests;
create policy "owners read hermes adaptive change requests"
on public.hermes_adaptive_change_requests
for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.hermes_adaptive_change_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  change_request_id uuid not null references public.hermes_adaptive_change_requests(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hermes_adaptive_change_audit_request_idx
  on public.hermes_adaptive_change_audit(change_request_id, created_at asc);

alter table public.hermes_adaptive_change_audit enable row level security;
revoke all on public.hermes_adaptive_change_audit from anon;
revoke all on public.hermes_adaptive_change_audit from authenticated;
grant select on public.hermes_adaptive_change_audit to authenticated;
grant all on public.hermes_adaptive_change_audit to service_role;

drop policy if exists "owners read hermes adaptive change audit"
  on public.hermes_adaptive_change_audit;
create policy "owners read hermes adaptive change audit"
on public.hermes_adaptive_change_audit
for select to authenticated
using ((select auth.uid()) = user_id);


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
