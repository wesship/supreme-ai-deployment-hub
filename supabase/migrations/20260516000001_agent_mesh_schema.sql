-- ==============================================================================
-- Migration: 20260516000001_agent_mesh_schema.sql
-- Description: Creates the agent mesh tables for Devonn.AI
--
-- Compatibility note:
-- The repository now also supports a newer workspace-scoped public.agents table.
-- This migration is still unapplied on production, so it must be replay-safe when
-- that newer table already exists. In that case we preserve the legacy task/result
-- contract without assuming agents.name is globally unique or that legacy agent
-- columns (base_url/capabilities) exist.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── agents ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  base_url      TEXT NOT NULL,
  capabilities  TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'idle'
                CHECK (status IN ('idle', 'busy', 'error', 'offline')),
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only replace the table comment when this migration owns the legacy agents shape.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'base_url'
  ) then
    comment on table public.agents is 'Registered Devonn.AI agent services in the mesh';
  end if;
end
$$;

-- ── agent_tasks ───────────────────────────────────────────────────────────────
-- Do not declare REFERENCES agents(name) inline. The modern workspace-scoped
-- agents table intentionally allows the same display name in different workspaces.
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name      TEXT NOT NULL,
  action          TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  retries_used    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve the original FK semantics only when agents.name is actually backed by
-- a single-column UNIQUE/PRIMARY KEY constraint (the legacy agents shape).
do $$
declare
  name_attnum smallint;
begin
  select a.attnum::smallint into name_attnum
  from pg_attribute a
  join pg_class t on t.oid = a.attrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'agents'
    and a.attname = 'name'
    and not a.attisdropped;

  if name_attnum is not null
     and exists (
       select 1
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
         and t.relname = 'agents'
         and c.contype in ('u', 'p')
         and c.conkey = array[name_attnum]::smallint[]
     )
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.agent_tasks'::regclass
         and conname = 'agent_tasks_agent_name_fkey'
     ) then
    alter table public.agent_tasks
      add constraint agent_tasks_agent_name_fkey
      foreign key (agent_name) references public.agents(name) on delete cascade;
  end if;
end
$$;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_name ON public.agent_tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_by ON public.agent_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON public.agent_tasks(created_at DESC);

COMMENT ON TABLE public.agent_tasks IS 'Log of all tasks dispatched to the agent mesh';

-- ── agent_results ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  agent_name    TEXT NOT NULL,
  success       BOOLEAN NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  error         TEXT,
  duration_ms   NUMERIC(10, 2),
  retries_used  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_results_task_id ON public.agent_results(task_id);

COMMENT ON TABLE public.agent_results IS 'Results returned from agent task executions';

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_results ENABLE ROW LEVEL SECURITY;

-- The broad legacy agents_select policy is safe only for the legacy mesh table.
-- Never add it to the newer workspace-scoped agents table.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'base_url'
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents' and policyname = 'agents_select'
  ) then
    create policy "agents_select" on public.agents
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_tasks' and policyname = 'agent_tasks_select_own'
  ) then
    create policy "agent_tasks_select_own" on public.agent_tasks
      for select to authenticated using (created_by = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_tasks' and policyname = 'agent_tasks_insert_own'
  ) then
    create policy "agent_tasks_insert_own" on public.agent_tasks
      for insert to authenticated with check (created_by = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_results' and policyname = 'agent_results_select_own'
  ) then
    create policy "agent_results_select_own" on public.agent_results
      for select to authenticated
      using (
        task_id in (
          select id from public.agent_tasks where created_by = auth.uid()
        )
      );
  end if;
end
$$;

-- ── Seed default agents ───────────────────────────────────────────────────────
-- Seed only when this migration owns the legacy agents shape. The modern
-- workspace-scoped table requires workspace/key/creator fields and must not be
-- populated with these global legacy rows.
do $$
declare
  name_attnum smallint;
begin
  select a.attnum::smallint into name_attnum
  from pg_attribute a
  join pg_class t on t.oid = a.attrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'agents'
    and a.attname = 'name'
    and not a.attisdropped;

  if exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'agents' and column_name = 'base_url'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'agents' and column_name = 'capabilities'
     )
     and exists (
       select 1
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
         and t.relname = 'agents'
         and c.contype in ('u', 'p')
         and c.conkey = array[name_attnum]::smallint[]
     ) then
    insert into public.agents (name, base_url, capabilities, status)
    values
      ('devonn-coordinator', 'https://coordinator.devonn.ai', array['plan','orchestrate','summarize','review'], 'offline'),
      ('openclaw-bridge', 'https://openclaw.devonn.ai', array['code_generate','code_review','test_generate'], 'offline')
    on conflict (name) do nothing;
  end if;
end
$$;
