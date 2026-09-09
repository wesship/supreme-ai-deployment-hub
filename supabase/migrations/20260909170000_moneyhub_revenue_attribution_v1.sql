-- MoneyHub Revenue Attribution Engine v1
-- Server-owned economic events with idempotent provider attribution.

CREATE TABLE IF NOT EXISTS public.moneyhub_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.money_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','failed','cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, correlation_id)
);

CREATE TABLE IF NOT EXISTS public.moneyhub_revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.money_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  run_id uuid REFERENCES public.moneyhub_agent_runs(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  source text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('pending','verified','settled','refunded','disputed','reversed')),
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.moneyhub_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.money_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  run_id uuid REFERENCES public.moneyhub_agent_runs(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  source text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('pending','verified','settled','refunded','disputed','reversed')),
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_moneyhub_agent_runs_agent_id ON public.moneyhub_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_agent_runs_user_id ON public.moneyhub_agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_revenue_agent_id ON public.moneyhub_revenue_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_revenue_user_id ON public.moneyhub_revenue_events(user_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_revenue_occurred_at ON public.moneyhub_revenue_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_moneyhub_cost_agent_id ON public.moneyhub_cost_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_cost_user_id ON public.moneyhub_cost_events(user_id);
CREATE INDEX IF NOT EXISTS idx_moneyhub_cost_occurred_at ON public.moneyhub_cost_events(occurred_at DESC);

ALTER TABLE public.moneyhub_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moneyhub_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moneyhub_cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MoneyHub agent runs"
  ON public.moneyhub_agent_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own MoneyHub revenue events"
  ON public.moneyhub_revenue_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own MoneyHub cost events"
  ON public.moneyhub_cost_events FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.moneyhub_agent_runs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.moneyhub_revenue_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.moneyhub_cost_events FROM authenticated;
GRANT SELECT ON public.moneyhub_agent_runs TO authenticated;
GRANT SELECT ON public.moneyhub_revenue_events TO authenticated;
GRANT SELECT ON public.moneyhub_cost_events TO authenticated;

CREATE OR REPLACE FUNCTION public.moneyhub_record_economic_event(
  p_kind text,
  p_user_id uuid,
  p_agent_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_source text,
  p_amount numeric,
  p_currency text DEFAULT 'USD',
  p_status text DEFAULT 'verified',
  p_description text DEFAULT NULL,
  p_run_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_event_id text := btrim(coalesce(p_provider_event_id, ''));
  v_source text := btrim(coalesce(p_source, ''));
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_status text := lower(btrim(coalesce(p_status, 'verified')));
  v_event uuid;
  v_inserted boolean := false;
BEGIN
  IF v_kind NOT IN ('revenue','cost') THEN RAISE EXCEPTION 'invalid_event_kind' USING ERRCODE = '22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023'; END IF;
  IF v_provider = '' OR v_event_id = '' OR v_source = '' THEN RAISE EXCEPTION 'missing_event_identity' USING ERRCODE = '22023'; END IF;
  IF v_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'invalid_currency' USING ERRCODE = '22023'; END IF;
  IF v_status NOT IN ('pending','verified','settled','refunded','disputed','reversed') THEN RAISE EXCEPTION 'invalid_event_status' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.money_agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'money_agent_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.moneyhub_agent_runs WHERE id = p_run_id AND agent_id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'moneyhub_run_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_kind = 'revenue' THEN
    INSERT INTO public.moneyhub_revenue_events (
      agent_id,user_id,run_id,provider,provider_event_id,source,amount,currency,status,description,metadata,occurred_at
    ) VALUES (
      p_agent_id,p_user_id,p_run_id,v_provider,v_event_id,v_source,p_amount,v_currency,v_status,p_description,coalesce(p_metadata,'{}'::jsonb),p_occurred_at
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id INTO v_event;
    v_inserted := v_event IS NOT NULL;

    IF v_inserted AND v_status IN ('verified','settled') THEN
      UPDATE public.money_agents
      SET total_earned = coalesce(total_earned,0) + p_amount
      WHERE id = p_agent_id AND user_id = p_user_id;
    END IF;

    IF NOT v_inserted THEN
      SELECT id INTO v_event FROM public.moneyhub_revenue_events
      WHERE provider = v_provider AND provider_event_id = v_event_id;
    END IF;
  ELSE
    INSERT INTO public.moneyhub_cost_events (
      agent_id,user_id,run_id,provider,provider_event_id,source,amount,currency,status,description,metadata,occurred_at
    ) VALUES (
      p_agent_id,p_user_id,p_run_id,v_provider,v_event_id,v_source,p_amount,v_currency,v_status,p_description,coalesce(p_metadata,'{}'::jsonb),p_occurred_at
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id INTO v_event;
    v_inserted := v_event IS NOT NULL;

    IF NOT v_inserted THEN
      SELECT id INTO v_event FROM public.moneyhub_cost_events
      WHERE provider = v_provider AND provider_event_id = v_event_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_event, 'kind', v_kind, 'inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.moneyhub_record_economic_event(text,uuid,uuid,text,text,text,numeric,text,text,text,uuid,jsonb,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moneyhub_record_economic_event(text,uuid,uuid,text,text,text,numeric,text,text,text,uuid,jsonb,timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.moneyhub_record_economic_event(text,uuid,uuid,text,text,text,numeric,text,text,text,uuid,jsonb,timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.moneyhub_record_economic_event(text,uuid,uuid,text,text,text,numeric,text,text,text,uuid,jsonb,timestamptz) TO service_role;
