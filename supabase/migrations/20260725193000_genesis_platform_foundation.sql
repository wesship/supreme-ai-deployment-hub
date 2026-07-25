-- D3VONN.IO Genesis Platform Foundation
-- Durable project, canon, knowledge, workflow, agent, render, and audit records.

create extension if not exists pgcrypto;

create or replace function public.genesis_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.genesis_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  canonical_key text not null unique,
  title text not null,
  slug text not null,
  project_type text not null default 'film',
  description text,
  status text not null default 'development',
  target_release_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  constraint genesis_projects_status_check check (
    status in ('development','preproduction','production','postproduction','review','release_ready','released','archived')
  )
);

create table if not exists public.genesis_project_members (
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  constraint genesis_project_members_role_check check (
    role in ('owner','executive_producer','director','writer','visual_director','audio_director','developer','reviewer','viewer')
  )
);

create table if not exists public.genesis_canon_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  canonical_key text not null unique,
  canon_type text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  authority_level smallint not null default 1 check (authority_level between 1 and 5),
  canon_status text not null default 'draft',
  locked boolean not null default false,
  version integer not null default 1,
  superseded_by uuid references public.genesis_canon_entries(id),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, title, version),
  constraint genesis_canon_status_check check (
    canon_status in ('draft','proposed','approved','locked','superseded','rejected')
  )
);

create table if not exists public.genesis_entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  canonical_key text not null unique,
  entity_type text not null,
  name text not null,
  summary text,
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.genesis_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  source_entity_id uuid not null references public.genesis_entities(id) on delete cascade,
  target_entity_id uuid not null references public.genesis_entities(id) on delete cascade,
  relationship_type text not null,
  strength numeric(5,4) not null default 1.0 check (strength between 0 and 1),
  confidence numeric(5,4) not null default 1.0 check (confidence between 0 and 1),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_entity_id, target_entity_id, relationship_type)
);

create table if not exists public.genesis_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  canonical_key text not null unique,
  asset_type text not null,
  title text not null,
  description text,
  lifecycle_status text not null default 'draft',
  canon_status text not null default 'unreviewed',
  current_version_id uuid,
  created_by_user_id uuid references auth.users(id),
  created_by_agent_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint genesis_assets_lifecycle_check check (
    lifecycle_status in ('draft','generating','review','revision','approved','delivered','archived','failed')
  )
);

create table if not exists public.genesis_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.genesis_assets(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  parent_version_id uuid references public.genesis_asset_versions(id),
  storage_path text,
  checksum text,
  mime_type text,
  file_size_bytes bigint,
  content_text text,
  structured_content jsonb,
  change_summary text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id),
  created_by_agent_id uuid,
  created_at timestamptz not null default now(),
  unique (asset_id, version_number)
);

alter table public.genesis_assets
  drop constraint if exists genesis_assets_current_version_id_fkey;
alter table public.genesis_assets
  add constraint genesis_assets_current_version_id_fkey
  foreign key (current_version_id) references public.genesis_asset_versions(id);

create table if not exists public.genesis_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.genesis_projects(id) on delete cascade,
  canonical_key text not null unique,
  name text not null,
  agent_type text not null default 'specialist',
  description text,
  capabilities jsonb not null default '[]'::jsonb,
  tool_permissions jsonb not null default '{}'::jsonb,
  governance_level text not null default 'assisted',
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint genesis_agents_governance_check check (
    governance_level in ('advisory','assisted','supervised','autonomous_limited','autonomous')
  )
);

create table if not exists public.genesis_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  title text not null,
  objective text not null,
  priority integer not null default 3 check (priority between 1 and 5),
  status text not null default 'draft',
  success_criteria jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  initiated_by_user_id uuid references auth.users(id),
  initiated_by_agent_id uuid references public.genesis_agents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint genesis_goals_status_check check (
    status in ('draft','active','blocked','review','completed','cancelled','failed')
  )
);

create table if not exists public.genesis_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  goal_id uuid references public.genesis_goals(id) on delete cascade,
  parent_task_id uuid references public.genesis_tasks(id),
  canonical_key text unique,
  title text not null,
  description text,
  task_type text not null default 'generic',
  priority integer not null default 3 check (priority between 1 and 5),
  status text not null default 'backlog',
  assigned_user_id uuid references auth.users(id),
  assigned_agent_id uuid references public.genesis_agents(id),
  lease_expires_at timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint genesis_tasks_status_check check (
    status in ('backlog','ready','claimed','in_progress','waiting','blocked','review','revision','approved','completed','cancelled','failed')
  )
);

create table if not exists public.genesis_executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.genesis_tasks(id) on delete cascade,
  agent_id uuid not null references public.genesis_agents(id),
  attempt integer not null default 1,
  status text not null default 'pending',
  objective text not null,
  input_context jsonb not null default '{}'::jsonb,
  plan jsonb,
  output jsonb,
  verification_result jsonb,
  tool_usage jsonb not null default '[]'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, attempt),
  constraint genesis_executions_status_check check (
    status in ('pending','running','waiting','checkpointed','completed','failed','cancelled')
  )
);

create table if not exists public.genesis_execution_checkpoints (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.genesis_executions(id) on delete cascade,
  sequence_number integer not null,
  phase text,
  progress numeric(5,4) check (progress between 0 and 1),
  state_snapshot jsonb not null default '{}'::jsonb,
  completed_steps jsonb not null default '[]'::jsonb,
  pending_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (execution_id, sequence_number)
);

create table if not exists public.genesis_workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.genesis_projects(id) on delete cascade,
  workflow_key text not null,
  name text not null,
  description text,
  version integer not null default 1,
  definition jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, workflow_key, version)
);

create table if not exists public.genesis_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid references public.genesis_workflow_definitions(id),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  workflow_key text not null,
  status text not null default 'pending',
  context jsonb not null default '{}'::jsonb,
  progress numeric(5,4) not null default 0 check (progress between 0 and 1),
  current_phase text,
  initiated_by_user_id uuid references auth.users(id),
  initiated_by_agent_id uuid references public.genesis_agents(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint genesis_workflow_runs_status_check check (
    status in ('draft','pending','scheduled','running','waiting','paused','blocked','cancelling','cancelled','failed','completed','completed_with_warnings')
  )
);

create table if not exists public.genesis_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.genesis_workflow_runs(id) on delete cascade,
  step_key text not null,
  name text not null,
  step_type text not null,
  status text not null default 'pending',
  sequence_order integer not null default 0,
  weight numeric(8,3) not null default 1,
  depends_on jsonb not null default '[]'::jsonb,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  unique (workflow_run_id, step_key),
  constraint genesis_workflow_steps_status_check check (
    status in ('pending','ready','claimed','running','waiting','blocked','retry_scheduled','succeeded','failed','skipped','cancelled','compensated')
  )
);

create table if not exists public.genesis_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  asset_id uuid references public.genesis_assets(id),
  task_id uuid references public.genesis_tasks(id),
  reviewer_user_id uuid references auth.users(id),
  reviewer_agent_id uuid references public.genesis_agents(id),
  review_type text not null,
  status text not null default 'pending',
  score numeric(5,2),
  findings jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint genesis_reviews_status_check check (
    status in ('pending','in_progress','passed','passed_with_notes','revision_required','rejected','escalated')
  )
);

create table if not exists public.genesis_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  approval_type text not null,
  status text not null default 'pending',
  requested_by_user_id uuid references auth.users(id),
  requested_by_agent_id uuid references public.genesis_agents(id),
  decided_by_user_id uuid references auth.users(id),
  risk_level text not null default 'low',
  estimated_cost_usd numeric(14,4),
  conditions jsonb not null default '{}'::jsonb,
  decision_notes text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint genesis_approvals_status_check check (
    status in ('pending','approved','approved_with_conditions','rejected','revoked','expired')
  )
);

create table if not exists public.genesis_render_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  asset_id uuid references public.genesis_assets(id),
  domain text not null,
  operation text not null,
  objective text not null,
  normalized_request jsonb not null default '{}'::jsonb,
  routing_profile text not null default 'balanced',
  status text not null default 'draft',
  selected_provider text,
  selected_model text,
  maximum_cost_usd numeric(14,4),
  estimated_cost_usd numeric(14,4),
  final_cost_usd numeric(14,4),
  idempotency_key text not null,
  created_by_user_id uuid references auth.users(id),
  created_by_agent_id uuid references public.genesis_agents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key),
  constraint genesis_render_status_check check (
    status in ('draft','validated','estimated','approval_pending','queued','submitted','processing','output_available','ingesting','validating','registered','completed','rejected','cancel_requested','cancelled','retry_scheduled','fallback_routing','failed','quarantined','expired')
  )
);

create table if not exists public.genesis_provider_jobs (
  id uuid primary key default gen_random_uuid(),
  render_request_id uuid not null references public.genesis_render_requests(id) on delete cascade,
  provider_key text not null,
  model_key text,
  provider_job_id text,
  route_attempt integer not null default 1,
  status text not null default 'queued',
  provider_request_redacted jsonb not null default '{}'::jsonb,
  provider_response_redacted jsonb,
  estimated_completion_at timestamptz,
  submitted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.genesis_provider_outputs (
  id uuid primary key default gen_random_uuid(),
  provider_job_id uuid not null references public.genesis_provider_jobs(id) on delete cascade,
  output_index integer not null,
  provider_reference text,
  quarantine_path text,
  final_storage_path text,
  checksum text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending',
  asset_version_id uuid references public.genesis_asset_versions(id),
  created_at timestamptz not null default now(),
  unique (provider_job_id, output_index)
);

create table if not exists public.genesis_domain_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.genesis_projects(id) on delete cascade,
  event_type text not null,
  event_version integer not null default 1,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_type text not null,
  actor_id uuid,
  correlation_id uuid,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.genesis_event_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.genesis_projects(id) on delete cascade,
  event_type text not null,
  event_version integer not null default 1,
  aggregate_type text not null,
  aggregate_id uuid not null,
  correlation_id uuid,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error jsonb,
  created_at timestamptz not null default now(),
  constraint genesis_outbox_status_check check (status in ('pending','publishing','published','failed'))
);

create table if not exists public.genesis_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  command_type text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key, command_type)
);

create index if not exists genesis_projects_owner_status_idx on public.genesis_projects(owner_id, status);
create index if not exists genesis_canon_project_status_idx on public.genesis_canon_entries(project_id, canon_status, locked);
create index if not exists genesis_entities_project_type_idx on public.genesis_entities(project_id, entity_type);
create index if not exists genesis_relationships_source_idx on public.genesis_relationships(source_entity_id);
create index if not exists genesis_relationships_target_idx on public.genesis_relationships(target_entity_id);
create index if not exists genesis_assets_project_status_idx on public.genesis_assets(project_id, lifecycle_status);
create index if not exists genesis_tasks_project_status_idx on public.genesis_tasks(project_id, status, priority);
create index if not exists genesis_workflow_runs_project_status_idx on public.genesis_workflow_runs(project_id, status);
create index if not exists genesis_approvals_project_status_idx on public.genesis_approvals(project_id, status);
create index if not exists genesis_render_project_status_idx on public.genesis_render_requests(project_id, status);
create index if not exists genesis_events_project_created_idx on public.genesis_domain_events(project_id, created_at desc);
create index if not exists genesis_outbox_pending_idx on public.genesis_event_outbox(status, available_at) where status = 'pending';

create or replace function public.genesis_has_project_access(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.genesis_projects p
    where p.id = p_project_id
      and (
        p.owner_id = p_user_id
        or exists (
          select 1
          from public.genesis_project_members m
          where m.project_id = p.id and m.user_id = p_user_id
        )
      )
  );
$$;

create or replace function public.genesis_project_command_center(p_project_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'counts', jsonb_build_object(
      'canon', (select count(*) from public.genesis_canon_entries c where c.project_id = p.id),
      'locked_canon', (select count(*) from public.genesis_canon_entries c where c.project_id = p.id and c.locked),
      'assets', (select count(*) from public.genesis_assets a where a.project_id = p.id),
      'approved_assets', (select count(*) from public.genesis_assets a where a.project_id = p.id and a.lifecycle_status = 'approved'),
      'open_tasks', (select count(*) from public.genesis_tasks t where t.project_id = p.id and t.status not in ('completed','cancelled','failed')),
      'blocked_tasks', (select count(*) from public.genesis_tasks t where t.project_id = p.id and t.status = 'blocked'),
      'active_workflows', (select count(*) from public.genesis_workflow_runs w where w.project_id = p.id and w.status in ('pending','scheduled','running','waiting','paused','blocked')),
      'pending_approvals', (select count(*) from public.genesis_approvals a where a.project_id = p.id and a.status = 'pending'),
      'active_agents', (select count(*) from public.genesis_agents a where (a.project_id = p.id or a.project_id is null) and a.active)
    ),
    'recent_events', coalesce((
      select jsonb_agg(event_row order by event_row.created_at desc)
      from (
        select e.id, e.event_type, e.aggregate_type, e.aggregate_id, e.payload, e.created_at
        from public.genesis_domain_events e
        where e.project_id = p.id
        order by e.created_at desc
        limit 12
      ) event_row
    ), '[]'::jsonb)
  )
  from public.genesis_projects p
  where p.id = p_project_id;
$$;

create or replace function public.genesis_claim_task(p_task_id uuid, p_agent_id uuid, p_lease_seconds integer default 900)
returns public.genesis_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.genesis_tasks;
begin
  update public.genesis_tasks
  set status = 'claimed',
      assigned_agent_id = p_agent_id,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
      updated_at = now()
  where id = p_task_id
    and status = 'ready'
    and (lease_expires_at is null or lease_expires_at < now())
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task_not_claimable';
  end if;

  return v_task;
end;
$$;

create or replace function public.genesis_emit_event(
  p_project_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id uuid default gen_random_uuid(),
  p_causation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := gen_random_uuid();
begin
  insert into public.genesis_domain_events(
    id, project_id, event_type, aggregate_type, aggregate_id,
    actor_type, actor_id, correlation_id, causation_id, payload
  ) values (
    v_event_id, p_project_id, p_event_type, p_aggregate_type, p_aggregate_id,
    p_actor_type, p_actor_id, p_correlation_id, p_causation_id, coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.genesis_event_outbox(
    project_id, event_type, aggregate_type, aggregate_id,
    correlation_id, causation_id, payload
  ) values (
    p_project_id, p_event_type, p_aggregate_type, p_aggregate_id,
    p_correlation_id, p_causation_id, coalesce(p_payload, '{}'::jsonb)
  );

  return v_event_id;
end;
$$;

-- Updated-at triggers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'genesis_projects','genesis_canon_entries','genesis_entities','genesis_assets',
    'genesis_agents','genesis_goals','genesis_tasks','genesis_workflow_runs','genesis_render_requests'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.genesis_set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- Row-level security.
alter table public.genesis_projects enable row level security;
alter table public.genesis_project_members enable row level security;
alter table public.genesis_canon_entries enable row level security;
alter table public.genesis_entities enable row level security;
alter table public.genesis_relationships enable row level security;
alter table public.genesis_assets enable row level security;
alter table public.genesis_asset_versions enable row level security;
alter table public.genesis_agents enable row level security;
alter table public.genesis_goals enable row level security;
alter table public.genesis_tasks enable row level security;
alter table public.genesis_executions enable row level security;
alter table public.genesis_execution_checkpoints enable row level security;
alter table public.genesis_workflow_definitions enable row level security;
alter table public.genesis_workflow_runs enable row level security;
alter table public.genesis_workflow_steps enable row level security;
alter table public.genesis_reviews enable row level security;
alter table public.genesis_approvals enable row level security;
alter table public.genesis_render_requests enable row level security;
alter table public.genesis_provider_jobs enable row level security;
alter table public.genesis_provider_outputs enable row level security;
alter table public.genesis_domain_events enable row level security;
alter table public.genesis_event_outbox enable row level security;
alter table public.genesis_idempotency_records enable row level security;

create policy genesis_projects_select on public.genesis_projects
for select using (public.genesis_has_project_access(id));
create policy genesis_projects_insert on public.genesis_projects
for insert with check (owner_id = auth.uid());
create policy genesis_projects_update on public.genesis_projects
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy genesis_projects_delete on public.genesis_projects
for delete using (owner_id = auth.uid());

create policy genesis_members_access on public.genesis_project_members
for select using (public.genesis_has_project_access(project_id));
create policy genesis_members_owner_manage on public.genesis_project_members
for all using (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from public.genesis_projects p where p.id = project_id and p.owner_id = auth.uid())
);

-- Project-scoped table policies are generated consistently.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'genesis_canon_entries','genesis_entities','genesis_relationships','genesis_assets',
    'genesis_agents','genesis_goals','genesis_tasks','genesis_workflow_definitions',
    'genesis_workflow_runs','genesis_reviews','genesis_approvals','genesis_render_requests',
    'genesis_domain_events','genesis_event_outbox'
  ] loop
    execute format('create policy %I_project_access on public.%I for all using (public.genesis_has_project_access(project_id)) with check (public.genesis_has_project_access(project_id))', table_name, table_name);
  end loop;
end;
$$;

create policy genesis_asset_versions_access on public.genesis_asset_versions
for all using (
  exists (
    select 1 from public.genesis_assets a
    where a.id = asset_id and public.genesis_has_project_access(a.project_id)
  )
) with check (
  exists (
    select 1 from public.genesis_assets a
    where a.id = asset_id and public.genesis_has_project_access(a.project_id)
  )
);

create policy genesis_executions_access on public.genesis_executions
for all using (
  exists (
    select 1 from public.genesis_tasks t
    where t.id = task_id and public.genesis_has_project_access(t.project_id)
  )
) with check (
  exists (
    select 1 from public.genesis_tasks t
    where t.id = task_id and public.genesis_has_project_access(t.project_id)
  )
);

create policy genesis_checkpoints_access on public.genesis_execution_checkpoints
for all using (
  exists (
    select 1
    from public.genesis_executions e
    join public.genesis_tasks t on t.id = e.task_id
    where e.id = execution_id and public.genesis_has_project_access(t.project_id)
  )
) with check (
  exists (
    select 1
    from public.genesis_executions e
    join public.genesis_tasks t on t.id = e.task_id
    where e.id = execution_id and public.genesis_has_project_access(t.project_id)
  )
);

create policy genesis_workflow_steps_access on public.genesis_workflow_steps
for all using (
  exists (
    select 1 from public.genesis_workflow_runs w
    where w.id = workflow_run_id and public.genesis_has_project_access(w.project_id)
  )
) with check (
  exists (
    select 1 from public.genesis_workflow_runs w
    where w.id = workflow_run_id and public.genesis_has_project_access(w.project_id)
  )
);

create policy genesis_provider_jobs_access on public.genesis_provider_jobs
for all using (
  exists (
    select 1 from public.genesis_render_requests r
    where r.id = render_request_id and public.genesis_has_project_access(r.project_id)
  )
) with check (
  exists (
    select 1 from public.genesis_render_requests r
    where r.id = render_request_id and public.genesis_has_project_access(r.project_id)
  )
);

create policy genesis_provider_outputs_access on public.genesis_provider_outputs
for all using (
  exists (
    select 1
    from public.genesis_provider_jobs j
    join public.genesis_render_requests r on r.id = j.render_request_id
    where j.id = provider_job_id and public.genesis_has_project_access(r.project_id)
  )
) with check (
  exists (
    select 1
    from public.genesis_provider_jobs j
    join public.genesis_render_requests r on r.id = j.render_request_id
    where j.id = provider_job_id and public.genesis_has_project_access(r.project_id)
  )
);

create policy genesis_idempotency_owner_access on public.genesis_idempotency_records
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

comment on table public.genesis_projects is 'Root aggregate for Genesis creative and production projects.';
comment on table public.genesis_canon_entries is 'Versioned authority-ranked canon entries; locked entries require explicit governance.';
comment on table public.genesis_event_outbox is 'Transactional outbox for durable workflow/event publication.';
comment on function public.genesis_project_command_center(uuid) is 'Returns command-center counts and recent events for one accessible project.';
