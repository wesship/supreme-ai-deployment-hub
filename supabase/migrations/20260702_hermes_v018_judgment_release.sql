-- Hermes v0.18.0 / v2026.7.1 "The Judgment Release" additive migration

ALTER TABLE public.hermes_tasks
  ADD COLUMN IF NOT EXISTS completion_contract JSONB,
  ADD COLUMN IF NOT EXISTS verification_strategy TEXT NOT NULL DEFAULT 'evidence_required',
  ADD COLUMN IF NOT EXISTS verification_result JSONB,
  ADD COLUMN IF NOT EXISTS model_council TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hermes_release TEXT NOT NULL DEFAULT 'v2026.7.1',
  ADD COLUMN IF NOT EXISTS background_subagents_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_hermes_tasks_hermes_release
  ON public.hermes_tasks(hermes_release);

CREATE INDEX IF NOT EXISTS idx_hermes_tasks_completion_contract_gin
  ON public.hermes_tasks USING GIN (completion_contract);

CREATE TABLE IF NOT EXISTS public.hermes_model_council_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  task_id UUID REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.hermes_runs(id) ON DELETE CASCADE,
  council_name TEXT NOT NULL DEFAULT 'default',
  models TEXT[] NOT NULL DEFAULT '{}',
  aggregator_model TEXT,
  votes JSONB,
  final_answer JSONB,
  confidence NUMERIC(5,4),
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hermes_model_council_runs_task
  ON public.hermes_model_council_runs(task_id);

CREATE TABLE IF NOT EXISTS public.hermes_background_subagents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_task_id UUID REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  child_task_id UUID REFERENCES public.hermes_tasks(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED')),
  result JSONB
);

CREATE INDEX IF NOT EXISTS idx_hermes_background_subagents_parent
  ON public.hermes_background_subagents(parent_task_id);

ALTER TABLE public.hermes_memory
  ADD COLUMN IF NOT EXISTS journey_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learned_from TEXT;

CREATE INDEX IF NOT EXISTS idx_hermes_memory_journey_visible
  ON public.hermes_memory(journey_visible);

CREATE OR REPLACE TRIGGER trg_hermes_background_subagents_updated_at
  BEFORE UPDATE ON public.hermes_background_subagents
  FOR EACH ROW EXECUTE FUNCTION public.hermes_set_updated_at();

INSERT INTO public.agent_registry (name, display_name, role, description, capabilities, parent_agent, version, config)
VALUES
  ('COUNCIL', 'Hermes Model Council', 'mixture_of_agents',
   'Hermes v0.18 model council for Mixture-of-Agents review, scoring, and aggregation.',
   ARRAY['debate','vote','aggregate','verify','compare_models'], 'HERMES', 'v2026.7.1',
   '{"release":"The Judgment Release"}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  parent_agent = EXCLUDED.parent_agent,
  version = EXCLUDED.version,
  config = EXCLUDED.config,
  updated_at = now();
