-- Restore the Hermes runtime schema that previously existed only in
-- non-versioned migration scripts. This makes fresh Supabase branch replay
-- reproduce the production table, RLS, policy, trigger, and seed surface.

begin;

-- Keep the tracked Hermes task table aligned with the additive production schema.
alter table public.hermes_tasks add column if not exists agent_name text;
alter table public.hermes_tasks add column if not exists assigned_to text;
alter table public.hermes_tasks add column if not exists priority integer default 5;
alter table public.hermes_tasks add column if not exists retry_count integer default 0;
alter table public.hermes_tasks add column if not exists locked_at timestamptz;

create table if not exists public.hermes_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hermes_tasks(id) on delete cascade,
  agent_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  exit_status text,
  output jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hermes_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hermes_tasks(id) on delete set null,
  run_id uuid references public.hermes_runs(id) on delete set null,
  level text not null default 'info',
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

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
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'set_updated_at_' || table_name
    ) then
      execute format(
        'create trigger set_updated_at_%I before update on public.%I for each row execute function public.set_updated_at()',
        table_name,
        table_name
      );
    end if;
  end loop;
end
$$;

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
on conflict (agent_name) do nothing;

commit;
