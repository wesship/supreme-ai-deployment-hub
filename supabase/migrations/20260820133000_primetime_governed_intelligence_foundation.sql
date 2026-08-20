begin;

-- PRIMETIME governed intelligence foundation.
-- Forward-only. Historical PRIMETIME migrations remain immutable.
-- Do not execute against production until Issue #982 gates pass.

create schema if not exists extensions;

create table if not exists public.primetime_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid not null references public.primetime_leads(id) on delete cascade,
  person_id uuid references public.primetime_people(id) on delete set null,
  interaction_type text not null,
  channel text,
  external_event_id text,
  occurred_at timestamptz not null default now(),
  content text,
  structured_payload jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists primetime_interactions_external_event_unique
  on public.primetime_interactions(workspace_id, external_event_id)
  where external_event_id is not null;
create index if not exists primetime_interactions_lead_occurred_idx
  on public.primetime_interactions(lead_id, occurred_at desc);

create table if not exists public.primetime_dispatches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid not null references public.primetime_leads(id) on delete cascade,
  interaction_id uuid references public.primetime_interactions(id) on delete set null,
  requested_capabilities jsonb not null default '[]'::jsonb,
  authorized_context jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','dispatched','completed','failed','cancelled')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists primetime_dispatches_idempotency_unique
  on public.primetime_dispatches(workspace_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists primetime_dispatches_lead_created_idx
  on public.primetime_dispatches(lead_id, created_at desc);

create table if not exists public.primetime_agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  dispatch_id uuid not null references public.primetime_dispatches(id) on delete cascade,
  agent_code text not null,
  agent_version text,
  requested_capabilities jsonb not null default '[]'::jsonb,
  input_context jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now()
);

create index if not exists primetime_agent_runs_dispatch_idx
  on public.primetime_agent_runs(dispatch_id, created_at desc);
create index if not exists primetime_agent_runs_workspace_status_idx
  on public.primetime_agent_runs(workspace_id, status, created_at desc);

create table if not exists public.primetime_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid not null references public.primetime_leads(id) on delete cascade,
  interaction_id uuid references public.primetime_interactions(id) on delete set null,
  dispatch_id uuid references public.primetime_dispatches(id) on delete set null,
  artifact_type text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  governance_state text not null default 'ai_generated'
    check (governance_state in ('ai_generated','human_approved','externally_sent','rejected','superseded')),
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (governance_state <> 'human_approved' or (approved_by is not null and approved_at is not null)),
  check (governance_state <> 'externally_sent' or sent_at is not null)
);

create index if not exists primetime_artifacts_lead_created_idx
  on public.primetime_artifacts(lead_id, created_at desc);
create index if not exists primetime_artifacts_governance_idx
  on public.primetime_artifacts(workspace_id, governance_state, created_at desc);

-- pgvector is already managed in the extensions schema by the existing platform
-- hardening migration. Keep the column dimensionless until the actual embedding
-- model is confirmed; fixed-dimension ANN indexing is a later migration.
create table if not exists public.primetime_embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid references public.primetime_leads(id) on delete cascade,
  interaction_id uuid references public.primetime_interactions(id) on delete cascade,
  content text not null,
  embedding extensions.vector,
  embedding_model text not null,
  embedding_dimension integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (lead_id is not null or interaction_id is not null),
  check (embedding_dimension is null or embedding_dimension > 0)
);

create index if not exists primetime_embeddings_lead_created_idx
  on public.primetime_embeddings(lead_id, created_at desc);
create index if not exists primetime_embeddings_interaction_created_idx
  on public.primetime_embeddings(interaction_id, created_at desc);

-- Explicit governed state history. This is intentionally separate from the
-- existing CRM stage-transition history: pipeline stage and AI-workflow state
-- are different concerns.
create table if not exists public.primetime_governance_transitions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid not null references public.primetime_leads(id) on delete cascade,
  from_state text,
  to_state text not null,
  transition_reason text,
  actor_type text not null check (actor_type in ('system','agent','human','workflow')),
  actor_id uuid,
  dispatch_id uuid references public.primetime_dispatches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists primetime_governance_transitions_lead_idx
  on public.primetime_governance_transitions(lead_id, created_at desc);

-- Tenant isolation. The existing private membership helper is the canonical
-- RLS primitive for authenticated workspace membership.
alter table public.primetime_interactions enable row level security;
alter table public.primetime_dispatches enable row level security;
alter table public.primetime_agent_runs enable row level security;
alter table public.primetime_artifacts enable row level security;
alter table public.primetime_embeddings enable row level security;
alter table public.primetime_governance_transitions enable row level security;

drop policy if exists "primetime_interactions workspace members" on public.primetime_interactions;
create policy "primetime_interactions workspace members"
on public.primetime_interactions for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

drop policy if exists "primetime_dispatches workspace members" on public.primetime_dispatches;
create policy "primetime_dispatches workspace members"
on public.primetime_dispatches for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

drop policy if exists "primetime_agent_runs workspace members" on public.primetime_agent_runs;
create policy "primetime_agent_runs workspace members"
on public.primetime_agent_runs for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

drop policy if exists "primetime_artifacts workspace members" on public.primetime_artifacts;
create policy "primetime_artifacts workspace members"
on public.primetime_artifacts for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

drop policy if exists "primetime_embeddings workspace members" on public.primetime_embeddings;
create policy "primetime_embeddings workspace members"
on public.primetime_embeddings for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

drop policy if exists "primetime_governance_transitions workspace members" on public.primetime_governance_transitions;
create policy "primetime_governance_transitions workspace members"
on public.primetime_governance_transitions for all to authenticated
using (private.is_active_workspace_member(workspace_id))
with check (private.is_active_workspace_member(workspace_id));

-- Audit/state history must not be mutable by clients.
drop trigger if exists primetime_governance_transitions_immutable on public.primetime_governance_transitions;
create trigger primetime_governance_transitions_immutable
before update or delete on public.primetime_governance_transitions
for each row execute function public.primetime_prevent_audit_mutation();

commit;
