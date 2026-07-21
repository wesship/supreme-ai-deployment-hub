-- PRIMETIME Release 4: AI Assistance
-- Canonical tables: ai_agents, ai_actions, ai_approval_requests,
--                   knowledge_sources, knowledge_versions, compliance_checks
-- Exit gates: every_ai_action_logged, restricted_actions_require_approval,
--             rag_responses_cite_approved_sources,
--             no_independent_ai_product_recommendations

begin;

-- ────────────────────────────────────────────────────────────
-- AI agent registry (per-workspace agent definitions)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_ai_agents (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  name            text not null,
  slug            text not null,
  purpose         text not null,
  status          text not null default 'draft'
                    check (status in ('draft','active','suspended','retired')),
  requires_approval_for jsonb not null default '[]',
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ────────────────────────────────────────────────────────────
-- AI actions (every agent execution logged here)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_ai_actions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id            uuid references public.primetime_ai_agents(id) on delete restrict,
  initiated_by        uuid references public.primetime_workspace_memberships(id),
  lead_id             uuid references public.primetime_leads(id) on delete restrict,
  action_type         text not null,
  input_summary       text,
  output_summary      text,
  status              text not null default 'pending'
                        check (status in ('pending','running','awaiting_approval','approved','rejected','completed','failed')),
  requires_approval   boolean not null default false,
  approved_by         uuid references public.primetime_workspace_memberships(id),
  approved_at         timestamptz,
  rejected_by         uuid references public.primetime_workspace_memberships(id),
  rejected_at         timestamptz,
  rejection_reason    text,
  completed_at        timestamptz,
  error_message       text,
  audit_event_id      uuid references public.primetime_audit_events(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- AI approval requests (human-in-the-loop gate)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_ai_approval_requests (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  ai_action_id        uuid not null references public.primetime_ai_actions(id) on delete restrict,
  requested_at        timestamptz not null default now(),
  reviewer_member_id  uuid references public.primetime_workspace_memberships(id),
  decision            text check (decision in ('approved','rejected')),
  decided_at          timestamptz,
  decision_notes      text,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Knowledge sources (approved RAG sources)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_knowledge_sources (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  name            text not null,
  source_type     text not null check (source_type in ('document','url','database','manual')),
  status          text not null default 'draft'
                    check (status in ('draft','pending_review','approved','expired','archived')),
  approved_by     uuid references public.primetime_workspace_memberships(id),
  approved_at     timestamptz,
  expires_at      timestamptz,
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Knowledge versions (immutable content snapshots)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_knowledge_versions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  source_id       uuid not null references public.primetime_knowledge_sources(id) on delete restrict,
  version         integer not null default 1,
  content_hash    text not null,
  storage_path    text,
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  unique (source_id, version)
);

-- ────────────────────────────────────────────────────────────
-- Compliance checks (pre-execution policy evaluation)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_compliance_checks (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  ai_action_id        uuid references public.primetime_ai_actions(id) on delete restrict,
  rule_code           text not null,
  passed              boolean not null,
  failure_reason      text,
  checked_at          timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
create index if not exists primetime_ai_actions_workspace_created_idx
  on public.primetime_ai_actions(workspace_id, created_at desc);
create index if not exists primetime_ai_actions_lead_idx
  on public.primetime_ai_actions(lead_id, created_at desc);
create index if not exists primetime_ai_actions_status_idx
  on public.primetime_ai_actions(workspace_id, status);
create index if not exists primetime_ai_approval_action_idx
  on public.primetime_ai_approval_requests(ai_action_id);
create index if not exists primetime_knowledge_workspace_status_idx
  on public.primetime_knowledge_sources(workspace_id, status);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
alter table public.primetime_ai_agents enable row level security;
alter table public.primetime_ai_actions enable row level security;
alter table public.primetime_ai_approval_requests enable row level security;
alter table public.primetime_knowledge_sources enable row level security;
alter table public.primetime_knowledge_versions enable row level security;
alter table public.primetime_compliance_checks enable row level security;

-- ────────────────────────────────────────────────────────────
-- Enforcement: every AI action must have an audit event
-- ────────────────────────────────────────────────────────────
create or replace function public.primetime_require_ai_audit_event()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and new.audit_event_id is null then
    raise exception 'primetime: completed AI action must reference an audit_event_id';
  end if;
  return new;
end;
$$;

create trigger primetime_ai_actions_require_audit
  before update on public.primetime_ai_actions
  for each row execute function public.primetime_require_ai_audit_event();

-- ────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────
create trigger primetime_ai_agents_updated_at
  before update on public.primetime_ai_agents
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_ai_actions_updated_at
  before update on public.primetime_ai_actions
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_knowledge_sources_updated_at
  before update on public.primetime_knowledge_sources
  for each row execute function public.primetime_touch_updated_at();

commit;
