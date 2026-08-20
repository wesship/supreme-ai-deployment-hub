-- PRIMETIME forensic event ledger.
-- Forward-only migration. Do not execute in production until staging rehearsal.
-- Canonical workspace boundary: primetime_workspaces + private.is_active_workspace_member().

create table if not exists public.primetime_event_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete set null,
  interaction_id uuid references public.primetime_interactions(id) on delete set null,
  event_type text not null check (length(event_type) between 1 and 120),
  actor_type text not null check (actor_type in ('user','system','agent','webhook')),
  actor_id uuid,
  correlation_id text not null check (length(correlation_id) between 8 and 200),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists primetime_event_ledger_workspace_created_idx
  on public.primetime_event_ledger(workspace_id, created_at desc);
create index if not exists primetime_event_ledger_correlation_idx
  on public.primetime_event_ledger(workspace_id, correlation_id);
create index if not exists primetime_event_ledger_lead_created_idx
  on public.primetime_event_ledger(workspace_id, lead_id, created_at desc);

alter table public.primetime_event_ledger enable row level security;
alter table public.primetime_event_ledger force row level security;

drop policy if exists primetime_event_ledger_select on public.primetime_event_ledger;
create policy primetime_event_ledger_select on public.primetime_event_ledger
  for select using (private.is_active_workspace_member(workspace_id));

drop policy if exists primetime_event_ledger_insert on public.primetime_event_ledger;
create policy primetime_event_ledger_insert on public.primetime_event_ledger
  for insert with check (private.is_active_workspace_member(workspace_id));

-- No update/delete policies: ledger records are append-only through the application boundary.
comment on table public.primetime_event_ledger is
  'PRIMETIME append-only forensic event ledger; correlate every governed workflow transition and external side effect.';
