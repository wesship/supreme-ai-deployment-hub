-- PRIMETIME Intelligence Layer: DeepTutor-derived capabilities
--
-- Adds the reusable platform primitives that are currently missing from the
-- canonical PRIMETIME AI/RAG model: layered memory, chunk-level provenance,
-- reusable skills, durable agent runs, and model/cost telemetry.
--
-- Design rules:
--   * workspace_id is mandatory on every tenant-owned record.
--   * Direct browser access remains denied; trusted FastAPI/Edge paths use
--     service_role until explicit authenticated policies are introduced.
--   * Knowledge retrieval is limited to approved, non-expired versions.
--   * Memory is provenance-first and never becomes authoritative regulated data.
--   * AI execution remains subject to the existing approval/compliance layer.

begin;

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Layered long-term memory
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_memory_items (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  scope_type          text not null check (scope_type in ('workspace','user','agent','project','conversation')),
  scope_id            uuid,
  layer               text not null check (layer in ('L1_raw','L2_curated','L3_synthesized')),
  memory_type         text not null check (memory_type in ('fact','preference','decision','goal','summary','lesson','relationship','constraint')),
  content             text not null,
  source_type         text not null check (source_type in ('conversation','document','agent_run','human','system')),
  source_id           uuid,
  confidence          numeric(5,4) check (confidence is null or confidence between 0 and 1),
  status              text not null default 'active' check (status in ('active','superseded','expired','deleted')),
  review_after        timestamptz,
  expires_at          timestamptz,
  created_by          uuid references public.primetime_workspace_memberships(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists primetime_memory_workspace_scope_idx
  on public.primetime_memory_items(workspace_id, scope_type, scope_id, created_at desc);
create index if not exists primetime_memory_layer_status_idx
  on public.primetime_memory_items(workspace_id, layer, status);

-- ---------------------------------------------------------------------------
-- Versioned knowledge chunks with source provenance and vector retrieval
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_knowledge_chunks (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  source_id           uuid not null references public.primetime_knowledge_sources(id) on delete restrict,
  version_id           uuid not null references public.primetime_knowledge_versions(id) on delete restrict,
  chunk_index         integer not null check (chunk_index >= 0),
  content             text not null,
  content_hash        text not null,
  embedding           vector(1536),
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  unique (version_id, chunk_index)
);

create index if not exists primetime_knowledge_chunks_workspace_idx
  on public.primetime_knowledge_chunks(workspace_id, source_id, version_id);

-- HNSW is intentionally deferred until retrieval traffic justifies the index;
-- pgvector remains the canonical storage layer from the architecture document.

-- ---------------------------------------------------------------------------
-- Reusable, versioned skills (DeepTutor SKILL.md-inspired contract)
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_skills (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  name                text not null,
  slug                text not null,
  purpose             text not null,
  instructions        text not null,
  allowed_tools       jsonb not null default '[]',
  required_permissions jsonb not null default '[]',
  requires_approval   boolean not null default false,
  status              text not null default 'draft' check (status in ('draft','active','suspended','retired')),
  version             integer not null default 1 check (version > 0),
  created_by          uuid references public.primetime_workspace_memberships(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, slug, version)
);

create index if not exists primetime_skills_workspace_status_idx
  on public.primetime_skills(workspace_id, status, slug);

-- ---------------------------------------------------------------------------
-- Durable agent executions and sub-agent relationships
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_agent_runs (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id            uuid references public.primetime_ai_agents(id) on delete restrict,
  parent_run_id       uuid references public.primetime_agent_runs(id) on delete restrict,
  initiated_by        uuid references public.primetime_workspace_memberships(id),
  skill_id             uuid references public.primetime_skills(id) on delete restrict,
  status              text not null default 'queued' check (status in ('queued','running','awaiting_approval','completed','failed','cancelled')),
  input_summary       text,
  output_summary      text,
  started_at          timestamptz,
  completed_at        timestamptz,
  failure_code        text,
  failure_message     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists primetime_agent_runs_workspace_created_idx
  on public.primetime_agent_runs(workspace_id, created_at desc);
create index if not exists primetime_agent_runs_parent_idx
  on public.primetime_agent_runs(parent_run_id);

-- ---------------------------------------------------------------------------
-- Provider/model/token/cost telemetry
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_ai_usage (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_run_id        uuid references public.primetime_agent_runs(id) on delete restrict,
  ai_action_id        uuid references public.primetime_ai_actions(id) on delete restrict,
  provider            text not null,
  model               text not null,
  input_tokens        bigint not null default 0 check (input_tokens >= 0),
  output_tokens       bigint not null default 0 check (output_tokens >= 0),
  cached_tokens       bigint not null default 0 check (cached_tokens >= 0),
  estimated_cost_usd  numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  latency_ms          integer check (latency_ms is null or latency_ms >= 0),
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists primetime_ai_usage_workspace_created_idx
  on public.primetime_ai_usage(workspace_id, created_at desc);
create index if not exists primetime_ai_usage_run_idx
  on public.primetime_ai_usage(agent_run_id);

-- ---------------------------------------------------------------------------
-- Retrieval provenance: every RAG-backed answer can point to exact chunks.
-- ---------------------------------------------------------------------------
create table if not exists public.primetime_retrieval_events (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_run_id        uuid references public.primetime_agent_runs(id) on delete restrict,
  ai_action_id        uuid references public.primetime_ai_actions(id) on delete restrict,
  query_hash          text not null,
  retrieval_policy    jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create table if not exists public.primetime_retrieval_sources (
  retrieval_event_id  uuid not null references public.primetime_retrieval_events(id) on delete cascade,
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  chunk_id            uuid not null references public.primetime_knowledge_chunks(id) on delete restrict,
  rank                integer not null check (rank > 0),
  score               numeric(12,8),
  primary key (retrieval_event_id, chunk_id)
);

create index if not exists primetime_retrieval_sources_workspace_idx
  on public.primetime_retrieval_sources(workspace_id, retrieval_event_id, rank);

-- ---------------------------------------------------------------------------
-- RLS: conservative backend-only posture. This intentionally mirrors the
-- existing Phase 2A policy until explicit authenticated policies are reviewed.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'primetime_memory_items',
    'primetime_knowledge_chunks',
    'primetime_skills',
    'primetime_agent_runs',
    'primetime_ai_usage',
    'primetime_retrieval_events',
    'primetime_retrieval_sources'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', tbl);
    execute format('grant all privileges on table public.%I to service_role', tbl);
    execute format('drop policy if exists %I on public.%I', 'Deny direct browser access', tbl);
    execute format(
      'create policy %I on public.%I as permissive for all to anon, authenticated using (false) with check (false)',
      'Deny direct browser access', tbl
    );
  end loop;
end $$;

create trigger primetime_memory_items_updated_at
  before update on public.primetime_memory_items
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_skills_updated_at
  before update on public.primetime_skills
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_agent_runs_updated_at
  before update on public.primetime_agent_runs
  for each row execute function public.primetime_touch_updated_at();

commit;
