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
