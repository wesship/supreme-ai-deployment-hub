-- D3VONN Prompt Registry V2
-- Governed runtime prompt storage beneath the static prompts/agents/registry.json authority.
-- External prompt sources are service-only and enter as candidate by default.

create table if not exists public.prompt_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  source text not null check (source in ('internal', 'prompts_chat', 'generated', 'tenant')),
  source_external_id text,
  source_url text,
  scope text not null check (scope in ('system', 'agent', 'workflow', 'task')),
  agent_id text,
  category text,
  tags text[] not null default '{}',
  status text not null default 'candidate' check (status in ('candidate', 'reviewed', 'approved', 'quarantined', 'retired')),
  active_version_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_prompts_cannot_be_system_scope check (
    source = 'internal' or scope <> 'system'
  ),
  constraint external_source_identity check (
    source = 'internal' or source_external_id is not null
  )
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompt_registry(id) on delete restrict,
  version integer not null check (version > 0),
  content text not null check (length(content) > 0),
  variables jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  checksum text not null,
  risk_score numeric(6,5) not null default 0 check (risk_score >= 0 and risk_score <= 1),
  quality_score numeric(6,5) check (quality_score is null or (quality_score >= 0 and quality_score <= 1)),
  model_compatibility text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(prompt_id, version),
  unique(prompt_id, checksum)
);

alter table public.prompt_registry
  drop constraint if exists prompt_registry_active_version_id_fkey;

alter table public.prompt_registry
  add constraint prompt_registry_active_version_id_fkey
  foreign key (active_version_id) references public.prompt_versions(id) on delete set null;

create table if not exists public.prompt_evaluations (
  id uuid primary key default gen_random_uuid(),
  prompt_version_id uuid not null references public.prompt_versions(id) on delete restrict,
  agent_id text,
  model text,
  task_type text,
  success boolean not null,
  quality_score numeric(6,5) check (quality_score is null or (quality_score >= 0 and quality_score <= 1)),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(14,8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  evaluator_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompt_registry_resolve
  on public.prompt_registry(status, scope, agent_id, category);

create index if not exists idx_prompt_registry_source
  on public.prompt_registry(source, source_external_id);

create index if not exists idx_prompt_versions_prompt
  on public.prompt_versions(prompt_id, version desc);

create index if not exists idx_prompt_evaluations_version
  on public.prompt_evaluations(prompt_version_id, created_at desc);

-- Prompt versions are append-only. Provenance must remain reproducible.
create or replace function public.prevent_prompt_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'prompt_versions are immutable; create a new version instead';
end;
$$;

drop trigger if exists prompt_versions_immutable_update on public.prompt_versions;
create trigger prompt_versions_immutable_update
before update or delete on public.prompt_versions
for each row execute function public.prevent_prompt_version_mutation();

-- Keep registry updated_at deterministic without relying on application code.
create or replace function public.touch_prompt_registry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prompt_registry_touch_updated_at on public.prompt_registry;
create trigger prompt_registry_touch_updated_at
before update on public.prompt_registry
for each row execute function public.touch_prompt_registry_updated_at();

alter table public.prompt_registry enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.prompt_evaluations enable row level security;

-- Runtime registry is backend/service-role only. No anon/authenticated grants.
revoke all on table public.prompt_registry from anon, authenticated;
revoke all on table public.prompt_versions from anon, authenticated;
revoke all on table public.prompt_evaluations from anon, authenticated;

grant select, insert, update on table public.prompt_registry to service_role;
grant select, insert on table public.prompt_versions to service_role;
grant select, insert on table public.prompt_evaluations to service_role;

-- Explicit service-role policies document the intended access boundary even though
-- service_role normally bypasses RLS in Supabase deployments.
drop policy if exists prompt_registry_service_role_all on public.prompt_registry;
create policy prompt_registry_service_role_all on public.prompt_registry
  for all to service_role using (true) with check (true);

drop policy if exists prompt_versions_service_role_read_insert on public.prompt_versions;
create policy prompt_versions_service_role_read_insert on public.prompt_versions
  for select to service_role using (true);
create policy prompt_versions_service_role_insert on public.prompt_versions
  for insert to service_role with check (true);

drop policy if exists prompt_evaluations_service_role_read_insert on public.prompt_evaluations;
create policy prompt_evaluations_service_role_read_insert on public.prompt_evaluations
  for select to service_role using (true);
create policy prompt_evaluations_service_role_insert on public.prompt_evaluations
  for insert to service_role with check (true);

comment on table public.prompt_registry is 'Governed runtime prompt catalog; static agent/system authority remains in prompts/agents/registry.json.';
comment on table public.prompt_versions is 'Immutable prompt content versions with provenance, checksum, risk, and compatibility metadata.';
comment on table public.prompt_evaluations is 'Execution/evaluator telemetry used to rank and govern prompt versions.';
