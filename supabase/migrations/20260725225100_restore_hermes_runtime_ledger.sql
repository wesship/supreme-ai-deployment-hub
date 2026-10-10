-- Restore the Hermes runtime schema that previously existed only in
-- non-versioned migration scripts. This migration is intentionally idempotent:
-- it restores production-equivalent objects on a fresh replay and reconciles
-- those objects with the active backend/hermes/task_engine.py write contract.

begin;

-- ---------------------------------------------------------------------------
-- Canonical Hermes task runtime contract
-- ---------------------------------------------------------------------------

alter table public.hermes_tasks add column if not exists agent_name text;
alter table public.hermes_tasks add column if not exists assigned_to text;
alter table public.hermes_tasks add column if not exists priority integer default 5;
alter table public.hermes_tasks add column if not exists retry_count integer default 0;
alter table public.hermes_tasks add column if not exists locked_at timestamptz;
alter table public.hermes_tasks add column if not exists task_type text default 'generic';
alter table public.hermes_tasks add column if not exists source text default 'api';
alter table public.hermes_tasks add column if not exists description text;
alter table public.hermes_tasks add column if not exists input_data jsonb;
alter table public.hermes_tasks add column if not exists output_data jsonb;
alter table public.hermes_tasks add column if not exists scheduled_at timestamptz;
alter table public.hermes_tasks add column if not exists deadline_at timestamptz;
alter table public.hermes_tasks add column if not exists correlation_id text;
alter table public.hermes_tasks add column if not exists assigned_at timestamptz;

-- create_task() does not require a goal and does not send the legacy kind field.
alter table public.hermes_tasks alter column goal_id drop not null;
alter table public.hermes_tasks alter column kind set default 'task';
alter table public.hermes_tasks alter column task_type set default 'generic';
alter table public.hermes_tasks alter column task_type set not null;
alter table public.hermes_tasks alter column source set default 'api';
alter table public.hermes_tasks alter column source set not null;
alter table public.hermes_tasks alter column priority set default 5;
alter table public.hermes_tasks alter column retry_count set default 0;

-- The active Hermes contract uses uppercase lifecycle values.
alter table public.hermes_tasks drop constraint if exists hermes_tasks_status_check;
update public.hermes_tasks
set status = upper(status)
where status is not null;
alter table public.hermes_tasks alter column status set default 'PENDING';
alter table public.hermes_tasks alter column status set not null;
alter table public.hermes_tasks
  add constraint hermes_tasks_status_check
  check (status in (
    'PENDING', 'LOCKED', 'RUNNING', 'COMPLETED', 'FAILED',
    'RETRY', 'MANUAL_REVIEW', 'ESCALATED', 'PAUSED', 'CANCELLED'
  ));

-- ---------------------------------------------------------------------------
-- Run lifecycle
-- ---------------------------------------------------------------------------

create table if not exists public.hermes_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hermes_tasks(id) on delete cascade,
  agent_name text not null,
  run_number integer not null default 1,
  status text not null default 'PENDING',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  output_snapshot jsonb,
  error_detail text,
  tokens_used bigint,
  cost_usd numeric(14, 6),
  duration_ms bigint,
  -- Legacy production compatibility fields retained during migration.
  ended_at timestamptz,
  exit_status text,
  output jsonb,
  created_at timestamptz not null default now()
);

alter table public.hermes_runs add column if not exists run_number integer default 1;
alter table public.hermes_runs add column if not exists status text;
alter table public.hermes_runs add column if not exists finished_at timestamptz;
alter table public.hermes_runs add column if not exists output_snapshot jsonb;
alter table public.hermes_runs add column if not exists error_detail text;
alter table public.hermes_runs add column if not exists tokens_used bigint;
alter table public.hermes_runs add column if not exists cost_usd numeric(14, 6);
alter table public.hermes_runs add column if not exists duration_ms bigint;
-- These legacy columns exist in production but not in the canonical fresh
-- replay schema. Add them before the compatibility backfill references them.
alter table public.hermes_runs add column if not exists ended_at timestamptz;
alter table public.hermes_runs add column if not exists exit_status text;
alter table public.hermes_runs add column if not exists output jsonb;

update public.hermes_runs
set
  run_number = coalesce(run_number, 1),
  status = coalesce(
    status,
    case
      when upper(exit_status) in ('COMPLETED', 'FAILED', 'CANCELLED') then upper(exit_status)
      when ended_at is not null then 'COMPLETED'
      else 'PENDING'
    end
  ),
  finished_at = coalesce(finished_at, ended_at),
  output_snapshot = coalesce(output_snapshot, output);

alter table public.hermes_runs alter column run_number set default 1;
alter table public.hermes_runs alter column run_number set not null;
alter table public.hermes_runs alter column status set default 'PENDING';
alter table public.hermes_runs alter column status set not null;
alter table public.hermes_runs drop constraint if exists hermes_runs_status_check;
alter table public.hermes_runs
  add constraint hermes_runs_status_check
  check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'));

-- ---------------------------------------------------------------------------
-- Structured lifecycle logging
-- ---------------------------------------------------------------------------

create table if not exists public.hermes_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hermes_tasks(id) on delete set null,
  run_id uuid references public.hermes_runs(id) on delete set null,
  event text not null default 'legacy.log',
  agent_name text,
  correlation_id text,
  level text not null default 'info',
  message text,
  data jsonb,
  created_at timestamptz not null default now()
);

alter table public.hermes_logs add column if not exists event text default 'legacy.log';
alter table public.hermes_logs add column if not exists agent_name text;
alter table public.hermes_logs add column if not exists correlation_id text;
update public.hermes_logs set event = 'legacy.log' where event is null;
alter table public.hermes_logs alter column event set default 'legacy.log';
alter table public.hermes_logs alter column event set not null;
alter table public.hermes_logs alter column message drop not null;

-- ---------------------------------------------------------------------------
-- Additive Hermes service tables
-- ---------------------------------------------------------------------------

create table if not exists public.hermes_memory (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  memory_type text not null default 'episodic',
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hermes_followups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hermes_tasks(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_registry (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null unique,
  display_name text not null,
  role text not null,
  capabilities jsonb default '[]'::jsonb,
  status text not null default 'active',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hermes_runs enable row level security;
alter table public.hermes_logs enable row level security;
alter table public.hermes_memory enable row level security;
alter table public.hermes_followups enable row level security;
alter table public.agent_registry enable row level security;

-- Runtime services write through service_role; authenticated users retain the
-- production-equivalent read surface.
grant all on public.hermes_runs to service_role;
grant all on public.hermes_logs to service_role;
grant all on public.hermes_memory to service_role;
grant all on public.hermes_followups to service_role;
grant all on public.agent_registry to service_role;
grant select on public.hermes_runs to authenticated;
grant select on public.hermes_logs to authenticated;
grant select on public.hermes_memory to authenticated;
grant select on public.hermes_followups to authenticated;
grant select on public.agent_registry to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hermes_runs'
      and policyname = 'hermes_runs_select'
  ) then
    create policy "hermes_runs_select"
      on public.hermes_runs for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hermes_logs'
      and policyname = 'hermes_logs_select'
  ) then
    create policy "hermes_logs_select"
      on public.hermes_logs for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hermes_memory'
      and policyname = 'hermes_memory_select'
  ) then
    create policy "hermes_memory_select"
      on public.hermes_memory for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hermes_followups'
      and policyname = 'hermes_followups_select'
  ) then
    create policy "hermes_followups_select"
      on public.hermes_followups for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_registry'
      and policyname = 'agent_registry_select'
  ) then
    create policy "agent_registry_select"
      on public.agent_registry for select to authenticated using (true);
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['hermes_memory', 'hermes_followups', 'agent_registry']
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || table_name, table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_updated_at_' || table_name,
      table_name
    );
  end loop;
end
$$;

do $agent_registry_seed$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_registry'
      and column_name = 'agent_name'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_registry'
      and column_name = 'capabilities'
      and data_type = 'jsonb'
  ) then
    execute $seed$
      insert into public.agent_registry (agent_name, display_name, role, capabilities, status)
      values
        ('HERMES', 'Hermes Coordinator', 'orchestrator',
         '["task_planning","agent_dispatch","memory_management"]'::jsonb, 'active'),
        ('TARS', 'TARS Executor', 'executor',
         '["code_execution","tool_use","api_calls"]'::jsonb, 'active'),
        ('ION', 'ION Analytics', 'analyst',
         '["data_analysis","reporting","visualization"]'::jsonb, 'active'),
        ('SAPPHIRE', 'Sapphire Memory', 'memory',
         '["vector_search","knowledge_retrieval","summarization"]'::jsonb, 'active'),
        ('GUARDIAN', 'Guardian Safety', 'safety',
         '["content_filtering","policy_enforcement","audit_logging"]'::jsonb, 'active')
      on conflict (agent_name) do nothing
    $seed$;
  end if;
end
$agent_registry_seed$;

commit;
