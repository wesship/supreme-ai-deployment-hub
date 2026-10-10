-- ==============================================================================
-- Migration: 20260516000002_feature_flags_schema.sql
-- Description: Creates the feature_flags table for remote flag management
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.feature_flags IS 'Remote feature flags for Devonn.AI';

-- RLS: Anyone can read flags, only service role can write
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_all" ON public.feature_flags
  FOR SELECT TO authenticated, anon USING (active = true);

-- Seed default flags (all disabled by default in production)
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('multi_agent_mesh',       false, 'Enable the multi-agent mesh UI panel'),
  ('openclaw_bridge',        false, 'Enable OpenClaw code generation agent'),
  ('experimental_tools',     false, 'Show experimental tools in the sidebar'),
  ('beta_agents',            false, 'Show beta agent types in the agent selector'),
  ('chaos_testing_ui',       false, 'Show chaos testing controls (internal only)'),
  ('cost_dashboard',         false, 'Show AWS cost dashboard in settings'),
  ('supabase_realtime',      true,  'Use Supabase realtime subscriptions for live updates'),
  ('lighthouse_score_badge', false, 'Show Lighthouse performance score badge in header')
ON CONFLICT (key) DO NOTHING;
