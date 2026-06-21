-- ==============================================================================
-- Migration: 20260516000001_agent_mesh_schema.sql
-- Description: Creates the agent mesh tables for Devonn.AI
--
-- Tables:
--   agents          — registered agent services
--   agent_tasks     — task dispatch log with status tracking
--   agent_results   — results returned from agent executions
--
-- Apply with: supabase db push
-- ==============================================================================

-- Enable UUID extension
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

COMMENT ON TABLE public.agents IS 'Registered Devonn.AI agent services in the mesh';

-- ── agent_tasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name      TEXT NOT NULL REFERENCES public.agents(name) ON DELETE CASCADE,
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

-- Agents: readable by all authenticated users, writable by service role only
CREATE POLICY "agents_select" ON public.agents
  FOR SELECT TO authenticated USING (true);

-- Tasks: users can only see their own tasks
CREATE POLICY "agent_tasks_select_own" ON public.agent_tasks
  FOR SELECT TO authenticated USING (created_by = auth.uid());

CREATE POLICY "agent_tasks_insert_own" ON public.agent_tasks
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Results: users can see results for their own tasks
CREATE POLICY "agent_results_select_own" ON public.agent_results
  FOR SELECT TO authenticated
  USING (
    task_id IN (
      SELECT id FROM public.agent_tasks WHERE created_by = auth.uid()
    )
  );

-- ── Seed default agents ───────────────────────────────────────────────────────
INSERT INTO public.agents (name, base_url, capabilities, status)
VALUES
  ('devonn-coordinator', 'https://coordinator.d3vonn.io', ARRAY['plan','orchestrate','summarize','review'], 'offline'),
  ('openclaw-bridge',    'https://openclaw.d3vonn.io',    ARRAY['code_generate','code_review','test_generate'], 'offline')
ON CONFLICT (name) DO NOTHING;
