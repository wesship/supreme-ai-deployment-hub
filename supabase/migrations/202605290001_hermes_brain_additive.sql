-- Hermes Brain: Additive Migration (safe to run on existing schema)
-- Only adds tables/columns that don't already exist.
-- Does NOT modify or drop existing hermes_tasks, hermes_goals, etc.

-- ── 1. Add agent_name column to hermes_tasks if missing ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_tasks'
      AND column_name = 'agent_name'
  ) THEN
    ALTER TABLE public.hermes_tasks ADD COLUMN agent_name TEXT;
  END IF;
END $$;

-- ── 2. Add assigned_to column to hermes_tasks if missing ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_tasks'
      AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.hermes_tasks ADD COLUMN assigned_to TEXT;
  END IF;
END $$;

-- ── 3. Add priority column to hermes_tasks if missing ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_tasks'
      AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.hermes_tasks ADD COLUMN priority INTEGER DEFAULT 5;
  END IF;
END $$;

-- ── 4. Add retry_count column to hermes_tasks if missing ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_tasks'
      AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.hermes_tasks ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ── 5. Add locked_at column to hermes_tasks if missing ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_tasks'
      AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE public.hermes_tasks ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── 6. Create hermes_runs table if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  agent_name  TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  exit_status TEXT,
  output      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hermes_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hermes_runs' AND policyname='hermes_runs_select') THEN
    CREATE POLICY "hermes_runs_select" ON public.hermes_runs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 7. Create hermes_logs table if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES public.hermes_tasks(id) ON DELETE SET NULL,
  run_id     UUID REFERENCES public.hermes_runs(id) ON DELETE SET NULL,
  level      TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hermes_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hermes_logs' AND policyname='hermes_logs_select') THEN
    CREATE POLICY "hermes_logs_select" ON public.hermes_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 8. Create hermes_memory table if missing ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name  TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'episodic',
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hermes_memory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hermes_memory' AND policyname='hermes_memory_select') THEN
    CREATE POLICY "hermes_memory_select" ON public.hermes_memory FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 9. Create hermes_followups table if missing ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_followups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hermes_followups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hermes_followups' AND policyname='hermes_followups_select') THEN
    CREATE POLICY "hermes_followups_select" ON public.hermes_followups FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 10. Create agent_registry table if missing ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name   TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]'::JSONB,
  status       TEXT NOT NULL DEFAULT 'active',
  metadata     JSONB DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_registry' AND policyname='agent_registry_select') THEN
    CREATE POLICY "agent_registry_select" ON public.agent_registry FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed the registry only when this migration created or inherited the
-- agent_name/jsonb variant. The canonical name/text[] variant is seeded by
-- the preceding Hermes migration and must not be rewritten here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_registry'
      AND column_name = 'agent_name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_registry'
      AND column_name = 'capabilities'
      AND data_type = 'jsonb'
  ) THEN
    EXECUTE $seed$
      INSERT INTO public.agent_registry (agent_name, display_name, role, capabilities, status)
      VALUES
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
      ON CONFLICT (agent_name) DO NOTHING
    $seed$;
  END IF;
END
$$;

-- ── 11. Create user_roles table if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='user_roles_self_select') THEN
    CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 12. updated_at triggers for new tables ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['hermes_memory', 'hermes_followups', 'agent_registry']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'set_updated_at_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
