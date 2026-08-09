-- Forward-safe prerequisite for Hermes task execution and durable worker persistence.
-- Creates the active task-engine ledger only when missing. Runtime control data
-- remains backend-only: RLS is enabled with no anon/authenticated policies.

create table if not exists public.hermes_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  task_type text not null default 'generic',
  parent_task_id uuid references public.hermes_tasks(id) on delete set null,
  agent_name text,
  assigned_to text,
  assigned_at timestamptz,
  status text not null default 'PENDING' check (status in (
    'PENDING','LOCKED','RUNNING','COMPLETED','FAILED','RETRY',
    'MANUAL_REVIEW','ESCALATED','PAUSED','CANCELLED'
  )),
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  input_data jsonb,
  output_data jsonb,
  error_message text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  deadline_at timestamptz,
  correlation_id text,
  source text not null default 'api',
  priority integer not null default 5 check (priority between 1 and 10),
  locked_at timestamptz
);

create index if not exists hermes_tasks_status_idx on public.hermes_tasks(status);
create index if not exists hermes_tasks_agent_idx on public.hermes_tasks(agent_name);
create index if not exists hermes_tasks_created_idx on public.hermes_tasks(created_at desc);

create table if not exists public.hermes_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hermes_tasks(id) on delete cascade,
  agent_name text not null,
  run_number integer not null default 1,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  output_snapshot jsonb,
  error_detail text,
  tokens_used bigint,
  cost_usd numeric(14,6),
  duration_ms bigint,
  created_at timestamptz not null default now()
);

create index if not exists hermes_runs_task_idx on public.hermes_runs(task_id);
create index if not exists hermes_runs_status_idx on public.hermes_runs(status);

create table if not exists public.hermes_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hermes_tasks(id) on delete set null,
  run_id uuid references public.hermes_runs(id) on delete set null,
  event text not null,
  agent_name text,
  correlation_id text,
  level text not null default 'info' check (level in ('debug','info','warn','error','critical')),
  message text,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hermes_logs_task_idx on public.hermes_logs(task_id);
create index if not exists hermes_logs_created_idx on public.hermes_logs(created_at desc);

alter table public.hermes_tasks enable row level security;
alter table public.hermes_runs enable row level security;
alter table public.hermes_logs enable row level security;

grant all on public.hermes_tasks to service_role;
grant all on public.hermes_runs to service_role;
grant all on public.hermes_logs to service_role;

create or replace function public.hermes_runtime_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hermes_tasks_set_updated_at on public.hermes_tasks;
create trigger hermes_tasks_set_updated_at
before update on public.hermes_tasks
for each row execute function public.hermes_runtime_set_updated_at();
