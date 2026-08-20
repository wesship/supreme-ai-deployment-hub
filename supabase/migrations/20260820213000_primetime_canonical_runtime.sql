begin;

-- PRIMETIME runtime extension reconciled to the deployed canonical model.
-- Reuses organizations, crm_leads, fabric_events, agent_runs,
-- intelligence_actions, approval_requests, connector_actions and knowledge_embeddings.
-- No parallel workspace/lead/agent model is introduced.

create table if not exists public.primetime_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  interaction_type text not null check (length(interaction_type) between 1 and 80),
  channel text,
  external_event_id text,
  occurred_at timestamptz not null default now(),
  content text,
  structured_payload jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists primetime_interactions_external_event_unique
  on public.primetime_interactions(organization_id, external_event_id)
  where external_event_id is not null;
create index if not exists primetime_interactions_lead_occurred_idx
  on public.primetime_interactions(organization_id, lead_id, occurred_at desc);

create table if not exists public.primetime_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  interaction_id uuid references public.primetime_interactions(id) on delete set null,
  requested_capabilities jsonb not null default '[]'::jsonb,
  authorized_context jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','dispatched','completed','failed','cancelled')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists primetime_dispatches_idempotency_unique
  on public.primetime_dispatches(organization_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists primetime_dispatches_lead_created_idx
  on public.primetime_dispatches(organization_id, lead_id, created_at desc);

create table if not exists public.primetime_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  interaction_id uuid references public.primetime_interactions(id) on delete set null,
  dispatch_id uuid references public.primetime_dispatches(id) on delete set null,
  artifact_type text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  governance_state text not null default 'ai_generated'
    check (governance_state in ('ai_generated','human_approved','externally_sent','rejected','superseded')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (governance_state <> 'human_approved' or (approved_by is not null and approved_at is not null)),
  check (governance_state <> 'externally_sent' or sent_at is not null)
);
create index if not exists primetime_artifacts_lead_created_idx
  on public.primetime_artifacts(organization_id, lead_id, created_at desc);
create index if not exists primetime_artifacts_governance_idx
  on public.primetime_artifacts(organization_id, governance_state, created_at desc);

create table if not exists public.primetime_governance_transitions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  from_state text,
  to_state text not null,
  transition_reason text,
  actor_type text not null check (actor_type in ('system','agent','human','workflow')),
  actor_id uuid references auth.users(id),
  dispatch_id uuid references public.primetime_dispatches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists primetime_governance_transitions_lead_idx
  on public.primetime_governance_transitions(organization_id, lead_id, created_at desc);

create table if not exists public.primetime_ingest_idempotency (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_hash text not null check (length(request_hash) = 64),
  request_id text not null check (length(request_id) between 8 and 200),
  status text not null default 'claimed' check (status in ('claimed','accepted','failed')),
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, idempotency_key)
);
create index if not exists primetime_ingest_idempotency_created_idx
  on public.primetime_ingest_idempotency(organization_id, created_at desc);

-- Defense-in-depth: every new public table is RLS protected.
-- Authorization follows the existing organization_members model.

alter table public.primetime_interactions enable row level security;
alter table public.primetime_dispatches enable row level security;
alter table public.primetime_artifacts enable row level security;
alter table public.primetime_governance_transitions enable row level security;
alter table public.primetime_ingest_idempotency enable row level security;

create policy primetime_interactions_org_member on public.primetime_interactions
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_interactions.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_interactions.organization_id and m.user_id = auth.uid()));

create policy primetime_dispatches_org_member on public.primetime_dispatches
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_dispatches.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_dispatches.organization_id and m.user_id = auth.uid()));

create policy primetime_artifacts_org_member on public.primetime_artifacts
  for all to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_artifacts.organization_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.organization_members m where m.organization_id = primetime_artifacts.organization_id and m.user_id = auth.uid()));

create policy primetime_transitions_org_member on public.primetime_governance_transitions
  for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_governance_transitions.organization_id and m.user_id = auth.uid()));

create policy primetime_idempotency_org_member on public.primetime_ingest_idempotency
  for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = primetime_ingest_idempotency.organization_id and m.user_id = auth.uid()));

-- Command Center projection: CRM state + AI/runtime state + governance + activity.
create or replace view public.primetime_command_center
with (security_invoker = true)
as
select
  l.id as lead_id,
  l.organization_id,
  l.stage as crm_stage,
  l.estimated_value,
  l.probability,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  (
    select i.occurred_at from public.primetime_interactions i
    where i.organization_id = l.organization_id and i.lead_id = l.id
    order by i.occurred_at desc limit 1
  ) as latest_interaction_at,
  (
    select d.status from public.primetime_dispatches d
    where d.organization_id = l.organization_id and d.lead_id = l.id
    order by d.created_at desc limit 1
  ) as latest_dispatch_status,
  (
    select a.governance_state from public.primetime_artifacts a
    where a.organization_id = l.organization_id and a.lead_id = l.id
    order by a.created_at desc limit 1
  ) as latest_artifact_governance,
  (
    select ia.state from public.intelligence_actions ia
    where ia.organization_id = l.organization_id and ia.subject_type = 'crm_lead' and ia.subject_id = l.id
    order by ia.created_at desc limit 1
  ) as latest_intelligence_action_state
from public.crm_leads l
left join public.crm_contacts c on c.id = l.contact_id;

revoke all on public.primetime_command_center from anon;
grant select on public.primetime_command_center to authenticated;

commit;
