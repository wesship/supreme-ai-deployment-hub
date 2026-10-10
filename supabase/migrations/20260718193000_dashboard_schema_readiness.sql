-- Repair production dashboard schema drift and expose a narrow readiness probe.
-- Safe to re-run: all objects, indexes, policies, and columns are idempotent.

begin;

create extension if not exists pgcrypto;

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  executor text not null default 'hermes',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table if exists public.agent_activity_logs
  add column if not exists agent_name text;

create index if not exists workflows_user_id_idx
  on public.workflows(user_id);
create index if not exists workflows_updated_at_idx
  on public.workflows(updated_at desc);
create index if not exists workflow_runs_workflow_id_idx
  on public.workflow_runs(workflow_id);
create index if not exists workflow_runs_started_at_idx
  on public.workflow_runs(started_at desc);

alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;

drop policy if exists "workflow owners can read" on public.workflows;
create policy "workflow owners can read"
  on public.workflows for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "workflow owners can insert" on public.workflows;
create policy "workflow owners can insert"
  on public.workflows for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "workflow owners can update" on public.workflows;
create policy "workflow owners can update"
  on public.workflows for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "workflow owners can delete" on public.workflows;
create policy "workflow owners can delete"
  on public.workflows for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "workflow run owners can read" on public.workflow_runs;
create policy "workflow run owners can read"
  on public.workflow_runs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "workflow run owners can insert" on public.workflow_runs;
create policy "workflow run owners can insert"
  on public.workflow_runs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "workflow run owners can update" on public.workflow_runs;
create policy "workflow run owners can update"
  on public.workflow_runs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.dashboard_schema_readiness()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'ready',
      to_regclass('public.workflows') is not null
      and to_regclass('public.workflow_runs') is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'agent_activity_logs'
          and column_name = 'agent_name'
      ),
    'missing',
      to_jsonb(array_remove(array[
        case when to_regclass('public.workflows') is null
          then 'public.workflows' end,
        case when to_regclass('public.workflow_runs') is null
          then 'public.workflow_runs' end,
        case when not exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'agent_activity_logs'
            and column_name = 'agent_name'
        ) then 'public.agent_activity_logs.agent_name' end
      ]::text[], null))
  );
$$;

revoke all on function public.dashboard_schema_readiness() from public;
grant execute on function public.dashboard_schema_readiness()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
