-- =============================================================================
-- Hermes Database Brain Migration
-- Creates the 6 core Hermes runtime tables and agent_registry
-- Task states: PENDING, LOCKED, RUNNING, COMPLETED, FAILED, RETRY,
--              MANUAL_REVIEW, ESCALATED, PAUSED
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. hermes_tasks — primary work queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identity
  title           TEXT NOT NULL,
  description     TEXT,
  task_type       TEXT NOT NULL DEFAULT 'generic',  -- generic | plan | summarize | followup | voice | rag

  -- Hierarchy
  parent_task_id  UUID REFERENCES public.hermes_tasks(id) ON DELETE SET NULL,
  depth           INTEGER NOT NULL DEFAULT 0,
  max_depth       INTEGER NOT NULL DEFAULT 5,

  -- Assignment
  agent_name      TEXT,                             -- e.g. TARS, ION, SAPPHIRE
  assigned_at     TIMESTAMPTZ,

  -- State machine
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN (
                    'PENDING','LOCKED','RUNNING','COMPLETED',
                    'FAILED','RETRY','MANUAL_REVIEW','ESCALATED','PAUSED'
                  )),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,

  -- Payload
  input_data      JSONB,
  output_data     JSONB,
  error_message   TEXT,

  -- Scheduling
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,

  -- Tracing
  correlation_id  UUID,
  source          TEXT,                             -- api | voice | webhook | scheduler
  priority        INTEGER NOT NULL DEFAULT 5        -- 1 (highest) to 10 (lowest)
);

CREATE INDEX IF NOT EXISTS idx_hermes_tasks_status    ON public.hermes_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hermes_tasks_agent     ON public.hermes_tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_hermes_tasks_parent    ON public.hermes_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_hermes_tasks_created   ON public.hermes_tasks(created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. hermes_runs — execution history per task attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  task_id         UUID NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  agent_name      TEXT NOT NULL,
  run_number      INTEGER NOT NULL DEFAULT 1,

  status          TEXT NOT NULL DEFAULT 'RUNNING'
                  CHECK (status IN (
                    'RUNNING','COMPLETED','FAILED','CANCELLED'
                  )),

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,

  input_snapshot  JSONB,
  output_snapshot JSONB,
  error_detail    TEXT,
  tokens_used     INTEGER,
  cost_usd        NUMERIC(10,6)
);

CREATE INDEX IF NOT EXISTS idx_hermes_runs_task    ON public.hermes_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_hermes_runs_agent   ON public.hermes_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_hermes_runs_created ON public.hermes_runs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. hermes_logs — structured event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  task_id         UUID REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  run_id          UUID REFERENCES public.hermes_runs(id) ON DELETE CASCADE,
  agent_name      TEXT,
  correlation_id  UUID,

  level           TEXT NOT NULL DEFAULT 'info'
                  CHECK (level IN ('debug','info','warn','error','critical')),
  event           TEXT NOT NULL,
  message         TEXT,
  data            JSONB
);

CREATE INDEX IF NOT EXISTS idx_hermes_logs_task    ON public.hermes_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_hermes_logs_level   ON public.hermes_logs(level);
CREATE INDEX IF NOT EXISTS idx_hermes_logs_created ON public.hermes_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. hermes_memory — persistent agent memory / knowledge store
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  agent_name      TEXT NOT NULL,
  memory_type     TEXT NOT NULL DEFAULT 'fact'
                  CHECK (memory_type IN ('fact','summary','preference','context','embedding')),

  key             TEXT,                             -- optional lookup key
  content         TEXT NOT NULL,
  embedding       extensions.vector(1536),                     -- OpenAI text-embedding-3-small dimension
  metadata        JSONB,

  source_task_id  UUID REFERENCES public.hermes_tasks(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  importance      INTEGER NOT NULL DEFAULT 5        -- 1 (low) to 10 (critical)
);

CREATE INDEX IF NOT EXISTS idx_hermes_memory_agent   ON public.hermes_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_hermes_memory_type    ON public.hermes_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_hermes_memory_key     ON public.hermes_memory(key);
CREATE INDEX IF NOT EXISTS idx_hermes_memory_created ON public.hermes_memory(created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. hermes_followups — deferred follow-up actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_followups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  source_task_id  UUID REFERENCES public.hermes_tasks(id) ON DELETE SET NULL,
  agent_name      TEXT,

  followup_type   TEXT NOT NULL DEFAULT 'task'
                  CHECK (followup_type IN ('task','notification','webhook','email','voice')),

  title           TEXT NOT NULL,
  description     TEXT,
  payload         JSONB,

  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','SENT','COMPLETED','CANCELLED','FAILED')),

  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  priority        INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_hermes_followups_status   ON public.hermes_followups(status);
CREATE INDEX IF NOT EXISTS idx_hermes_followups_source   ON public.hermes_followups(source_task_id);
CREATE INDEX IF NOT EXISTS idx_hermes_followups_created  ON public.hermes_followups(created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. agent_registry — canonical agent definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  name            TEXT NOT NULL UNIQUE,             -- TARS, ION, SAPPHIRE, GUARDIAN, HERMES
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL,                    -- execution | analytics | memory | safety | orchestrator
  description     TEXT,

  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','maintenance','deprecated')),

  capabilities    TEXT[] NOT NULL DEFAULT '{}',     -- ['plan','summarize','followup','rag','voice']
  parent_agent    TEXT REFERENCES public.agent_registry(name) ON DELETE SET NULL,

  endpoint_url    TEXT,                             -- internal service URL if applicable
  config          JSONB,
  version         TEXT NOT NULL DEFAULT '1.0.0',

  last_seen_at    TIMESTAMPTZ,
  total_tasks     INTEGER NOT NULL DEFAULT 0,
  success_rate    NUMERIC(5,2)
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON public.agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_agent_registry_role   ON public.agent_registry(role);

-- ---------------------------------------------------------------------------
-- Seed the agent registry with the 5 core agents
-- ---------------------------------------------------------------------------
INSERT INTO public.agent_registry (name, display_name, role, description, capabilities, parent_agent, version)
VALUES
  ('HERMES', 'Hermes Orchestrator', 'orchestrator',
   'Central coordinator for the Devonn.ai agent mesh. Routes tasks, enforces governance, and manages the agent lifecycle.',
   ARRAY['orchestrate','govern','route','schedule','monitor'], NULL, '3.0.0'),

  ('TARS', 'TARS Execution Engine', 'execution',
   'Primary task execution agent. Handles planning, summarization, and follow-up generation.',
   ARRAY['plan','summarize','followup','execute'], 'HERMES', '2.0.0'),

  ('ION', 'ION Analytics Agent', 'analytics',
   'Real-time analytics, cost tracking, and performance monitoring across the agent mesh.',
   ARRAY['analyze','report','monitor','alert'], 'HERMES', '1.0.0'),

  ('SAPPHIRE', 'SAPPHIRE Memory Agent', 'memory',
   'Long-term memory storage, semantic search, and knowledge retrieval via vector embeddings.',
   ARRAY['remember','recall','embed','search'], 'HERMES', '1.0.0'),

  ('GUARDIAN', 'GUARDIAN Safety Agent', 'safety',
   'Policy enforcement, content filtering, IAM inspection, and agent firewall.',
   ARRAY['govern','filter','audit','block','allow'], 'HERMES', '1.0.0')

ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  version      = EXCLUDED.version,
  updated_at   = now();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.hermes_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_memory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_registry   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Authenticated users can read all tables (OCC dashboard).
CREATE POLICY "Authenticated read hermes_tasks"     ON public.hermes_tasks     FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read hermes_runs"      ON public.hermes_runs      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read hermes_logs"      ON public.hermes_logs      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read hermes_memory"    ON public.hermes_memory    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read hermes_followups" ON public.hermes_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read agent_registry"   ON public.agent_registry   FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- updated_at auto-trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hermes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_hermes_tasks_updated_at
  BEFORE UPDATE ON public.hermes_tasks
  FOR EACH ROW EXECUTE FUNCTION public.hermes_set_updated_at();

CREATE OR REPLACE TRIGGER trg_hermes_memory_updated_at
  BEFORE UPDATE ON public.hermes_memory
  FOR EACH ROW EXECUTE FUNCTION public.hermes_set_updated_at();

CREATE OR REPLACE TRIGGER trg_hermes_followups_updated_at
  BEFORE UPDATE ON public.hermes_followups
  FOR EACH ROW EXECUTE FUNCTION public.hermes_set_updated_at();

CREATE OR REPLACE TRIGGER trg_agent_registry_updated_at
  BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.hermes_set_updated_at();
