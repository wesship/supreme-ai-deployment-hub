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

create index if not exists workflows_user_id_idx on public.workflows(user_id);
create index if not exists workflows_updated_at_idx on public.workflows(updated_at desc);
create index if not exists workflow_runs_workflow_id_idx on public.workflow_runs(workflow_id);
create index if not exists workflow_runs_started_at_idx on public.workflow_runs(started_at desc);

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
  using (user_id = auth.uid()) with check (user_id = auth.uid());

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
  using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
