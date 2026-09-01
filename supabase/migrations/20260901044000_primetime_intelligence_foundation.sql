-- PRIMETIME intelligence foundation: memory, provenance, skills, durable runs,
-- and usage telemetry. Direct browser access remains denied.

begin;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'PRIMETIME intelligence requires the vector extension';
  end if;
end $$;

-- Production did not receive the historical Release 4 knowledge tables. Keep
-- this migration forward-compatible with staging, where they already exist.
create table if not exists public.primetime_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  name text not null,
  source_type text not null check (source_type in ('document','url','database','manual')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','expired','archived')),
  approved_by uuid references public.primetime_workspace_memberships(id),
  approved_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.primetime_workspace_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.primetime_knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  source_id uuid not null references public.primetime_knowledge_sources(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  content_hash text not null,
  storage_path text,
  created_by uuid references public.primetime_workspace_memberships(id),
  created_at timestamptz not null default now(),
  unique (source_id, version)
);

create table public.primetime_memory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace','user','agent','project','conversation')),
  scope_id uuid,
  layer text not null check (layer in ('L1_raw','L2_curated','L3_synthesized')),
  memory_type text not null check (memory_type in ('fact','preference','decision','goal','summary','lesson','relationship','constraint')),
  content text not null,
  source_type text not null check (source_type in ('conversation','document','agent_run','human','system')),
  source_id uuid,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  status text not null default 'active' check (status in ('active','superseded','expired','deleted')),
  review_after timestamptz,
  expires_at timestamptz,
  created_by uuid references public.primetime_workspace_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.primetime_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  source_id uuid not null references public.primetime_knowledge_sources(id) on delete restrict,
  version_id uuid not null references public.primetime_knowledge_versions(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  content_hash text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (version_id, chunk_index)
);

create table public.primetime_skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  name text not null,
  slug text not null,
  purpose text not null,
  instructions text not null,
  allowed_tools jsonb not null default '[]'::jsonb,
  required_permissions jsonb not null default '[]'::jsonb,
  requires_approval boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','suspended','retired')),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.primetime_workspace_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug, version)
);

create table public.primetime_agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id uuid references public.primetime_ai_agents(id) on delete restrict,
  parent_run_id uuid references public.primetime_agent_runs(id) on delete restrict,
  initiated_by uuid references public.primetime_workspace_memberships(id),
  skill_id uuid references public.primetime_skills(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','completed','failed','cancelled')),
  input_summary text,
  output_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.primetime_ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_run_id uuid references public.primetime_agent_runs(id) on delete restrict,
  ai_action_id uuid references public.primetime_ai_actions(id) on delete restrict,
  provider text not null,
  model text not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cached_tokens bigint not null default 0 check (cached_tokens >= 0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.primetime_retrieval_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_run_id uuid references public.primetime_agent_runs(id) on delete restrict,
  ai_action_id uuid references public.primetime_ai_actions(id) on delete restrict,
  query_hash text not null,
  retrieval_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.primetime_retrieval_sources (
  retrieval_event_id uuid not null references public.primetime_retrieval_events(id) on delete cascade,
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  chunk_id uuid not null references public.primetime_knowledge_chunks(id) on delete restrict,
  rank integer not null check (rank > 0),
  score numeric(12,8),
  primary key (retrieval_event_id, chunk_id)
);

create index primetime_memory_workspace_scope_idx on public.primetime_memory_items(workspace_id, scope_type, scope_id, created_at desc);
create index primetime_knowledge_chunks_workspace_idx on public.primetime_knowledge_chunks(workspace_id, source_id, version_id);
create index primetime_skills_workspace_status_idx on public.primetime_skills(workspace_id, status, slug);
create index primetime_agent_runs_workspace_created_idx on public.primetime_agent_runs(workspace_id, created_at desc);
create index primetime_agent_runs_parent_idx on public.primetime_agent_runs(parent_run_id);
create index primetime_ai_usage_workspace_created_idx on public.primetime_ai_usage(workspace_id, created_at desc);
create index primetime_ai_usage_run_idx on public.primetime_ai_usage(agent_run_id);
create index primetime_retrieval_sources_workspace_idx on public.primetime_retrieval_sources(workspace_id, retrieval_event_id, rank);
create index if not exists primetime_knowledge_workspace_status_idx on public.primetime_knowledge_sources(workspace_id, status);

create or replace function public.primetime_intelligence_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.primetime_intelligence_validate_workspace_links()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  linked_workspace uuid;
  linked_source uuid;
begin
  if tg_table_name = 'primetime_knowledge_sources' then
    if new.created_by is not null then
      select workspace_id into linked_workspace from public.primetime_workspace_memberships where id = new.created_by;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: knowledge source creator'; end if;
    end if;
    if new.approved_by is not null then
      select workspace_id into linked_workspace from public.primetime_workspace_memberships where id = new.approved_by;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: knowledge source approver'; end if;
    end if;
  elsif tg_table_name = 'primetime_knowledge_versions' then
    select workspace_id into linked_workspace from public.primetime_knowledge_sources where id = new.source_id;
    if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: knowledge version source'; end if;
    if new.created_by is not null then
      select workspace_id into linked_workspace from public.primetime_workspace_memberships where id = new.created_by;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: knowledge version creator'; end if;
    end if;
  elsif tg_table_name in ('primetime_memory_items', 'primetime_skills') and new.created_by is not null then
    select workspace_id into linked_workspace from public.primetime_workspace_memberships where id = new.created_by;
    if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: creator'; end if;
  elsif tg_table_name = 'primetime_knowledge_chunks' then
    select workspace_id into linked_workspace from public.primetime_knowledge_sources where id = new.source_id;
    if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: chunk source'; end if;
    select workspace_id, source_id into linked_workspace, linked_source from public.primetime_knowledge_versions where id = new.version_id;
    if linked_workspace is distinct from new.workspace_id or linked_source is distinct from new.source_id then raise exception 'workspace boundary: chunk version'; end if;
  elsif tg_table_name = 'primetime_agent_runs' then
    if new.agent_id is not null then
      select workspace_id into linked_workspace from public.primetime_ai_agents where id = new.agent_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: run agent'; end if;
    end if;
    if new.parent_run_id is not null then
      select workspace_id into linked_workspace from public.primetime_agent_runs where id = new.parent_run_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: parent run'; end if;
    end if;
    if new.initiated_by is not null then
      select workspace_id into linked_workspace from public.primetime_workspace_memberships where id = new.initiated_by;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: run initiator'; end if;
    end if;
    if new.skill_id is not null then
      select workspace_id into linked_workspace from public.primetime_skills where id = new.skill_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: run skill'; end if;
    end if;
  elsif tg_table_name = 'primetime_ai_usage' then
    if new.agent_run_id is not null then
      select workspace_id into linked_workspace from public.primetime_agent_runs where id = new.agent_run_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: usage run'; end if;
    end if;
    if new.ai_action_id is not null then
      select workspace_id into linked_workspace from public.primetime_ai_actions where id = new.ai_action_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: usage action'; end if;
    end if;
  elsif tg_table_name = 'primetime_retrieval_events' then
    if new.agent_run_id is not null then
      select workspace_id into linked_workspace from public.primetime_agent_runs where id = new.agent_run_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: retrieval run'; end if;
    end if;
    if new.ai_action_id is not null then
      select workspace_id into linked_workspace from public.primetime_ai_actions where id = new.ai_action_id;
      if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: retrieval action'; end if;
    end if;
  elsif tg_table_name = 'primetime_retrieval_sources' then
    select workspace_id into linked_workspace from public.primetime_retrieval_events where id = new.retrieval_event_id;
    if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: retrieval event'; end if;
    select workspace_id into linked_workspace from public.primetime_knowledge_chunks where id = new.chunk_id;
    if linked_workspace is distinct from new.workspace_id then raise exception 'workspace boundary: retrieval chunk'; end if;
  end if;
  return new;
end;
$$;

create trigger primetime_knowledge_sources_intelligence_guard before insert or update on public.primetime_knowledge_sources for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_knowledge_versions_intelligence_guard before insert or update on public.primetime_knowledge_versions for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_memory_workspace_guard before insert or update on public.primetime_memory_items for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_chunks_workspace_guard before insert or update on public.primetime_knowledge_chunks for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_skills_workspace_guard before insert or update on public.primetime_skills for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_agent_runs_workspace_guard before insert or update on public.primetime_agent_runs for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_ai_usage_workspace_guard before insert or update on public.primetime_ai_usage for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_retrieval_events_workspace_guard before insert or update on public.primetime_retrieval_events for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_retrieval_sources_workspace_guard before insert or update on public.primetime_retrieval_sources for each row execute function public.primetime_intelligence_validate_workspace_links();
create trigger primetime_memory_items_updated_at before update on public.primetime_memory_items for each row execute function public.primetime_intelligence_touch_updated_at();
create trigger primetime_skills_updated_at before update on public.primetime_skills for each row execute function public.primetime_intelligence_touch_updated_at();
create trigger primetime_agent_runs_updated_at before update on public.primetime_agent_runs for each row execute function public.primetime_intelligence_touch_updated_at();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'primetime_knowledge_sources','primetime_knowledge_versions','primetime_memory_items',
    'primetime_knowledge_chunks','primetime_skills','primetime_agent_runs',
    'primetime_ai_usage','primetime_retrieval_events','primetime_retrieval_sources'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    execute format('grant all on table public.%I to service_role', tbl);
    execute format('drop policy if exists %I on public.%I', 'Deny direct browser access', tbl);
    execute format('create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', 'Deny direct browser access', tbl);
  end loop;
end $$;

revoke all on function public.primetime_intelligence_touch_updated_at() from public, anon, authenticated;
revoke all on function public.primetime_intelligence_validate_workspace_links() from public, anon, authenticated;
grant execute on function public.primetime_intelligence_touch_updated_at() to service_role;
grant execute on function public.primetime_intelligence_validate_workspace_links() to service_role;

commit;
