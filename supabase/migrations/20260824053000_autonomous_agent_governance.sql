begin;

-- Durable governance records for autonomous runs. These tables intentionally
-- contain metadata and audit state only; provider credentials remain server-side.
create table if not exists public.devonn_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  goal text not null,
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','succeeded','failed','cancelled')),
  agent_count integer not null default 0 check (agent_count >= 0),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  max_depth integer not null default 3 check (max_depth >= 0),
  estimated_cost_usd numeric(12,4) not null default 0 check (estimated_cost_usd >= 0),
  budget_usd numeric(12,4) not null default 10 check (budget_usd >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.devonn_agent_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.devonn_agent_runs(id) on delete cascade,
  user_id uuid,
  action text not null,
  tool_name text not null,
  risk_tier text not null check (risk_tier in ('deploy','destructive')),
  status text not null default 'pending' check (status in ('pending','approved','denied','expired')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_reason text
);

create table if not exists public.devonn_agent_audit_events (
  id bigint generated always as identity primary key,
  run_id uuid references public.devonn_agent_runs(id) on delete set null,
  user_id uuid,
  event_type text not null,
  tool_name text,
  risk_tier text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists devonn_agent_runs_user_created_idx on public.devonn_agent_runs(user_id, created_at desc);
create index if not exists devonn_agent_runs_status_idx on public.devonn_agent_runs(status, created_at desc);
create index if not exists devonn_agent_approvals_run_status_idx on public.devonn_agent_approvals(run_id, status);
create index if not exists devonn_agent_audit_run_created_idx on public.devonn_agent_audit_events(run_id, created_at desc);

alter table public.devonn_agent_runs enable row level security;
alter table public.devonn_agent_approvals enable row level security;
alter table public.devonn_agent_audit_events enable row level security;

-- Users may inspect their own governance records. Mutations should be made by
-- the authenticated server-side API/service role, not directly by the browser.
drop policy if exists devonn_agent_runs_select_own on public.devonn_agent_runs;
create policy devonn_agent_runs_select_own on public.devonn_agent_runs
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists devonn_agent_approvals_select_own on public.devonn_agent_approvals;
create policy devonn_agent_approvals_select_own on public.devonn_agent_approvals
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists devonn_agent_audit_select_own on public.devonn_agent_audit_events;
create policy devonn_agent_audit_select_own on public.devonn_agent_audit_events
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.devonn_agent_runs from anon, authenticated;
revoke insert, update, delete on public.devonn_agent_approvals from anon, authenticated;
revoke insert, update, delete on public.devonn_agent_audit_events from anon, authenticated;

grant select on public.devonn_agent_runs to authenticated;
grant select on public.devonn_agent_approvals to authenticated;
grant select on public.devonn_agent_audit_events to authenticated;

grant all on public.devonn_agent_runs to service_role;
grant all on public.devonn_agent_approvals to service_role;
grant all on public.devonn_agent_audit_events to service_role;

commit;
