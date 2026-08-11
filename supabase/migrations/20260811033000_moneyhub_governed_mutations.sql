-- Govern MoneyHub browser mutations while keeping financial totals read-only.
-- Existing RLS remains the row-ownership boundary. This migration adds a
-- privilege boundary so authenticated browser sessions cannot fabricate
-- earnings, lifetime totals, or run counters.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.agent_earnings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.money_agents FROM authenticated;

GRANT SELECT ON TABLE public.money_agents TO authenticated;
GRANT SELECT ON TABLE public.agent_earnings TO authenticated;

CREATE OR REPLACE FUNCTION public.moneyhub_create_agent(
  p_name text,
  p_category text DEFAULT 'automation',
  p_description text DEFAULT NULL
)
RETURNS public.money_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_row public.money_agents;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_agent_name' USING ERRCODE = '22023';
  END IF;
  IF v_category = '' OR length(v_category) > 80 THEN
    RAISE EXCEPTION 'invalid_agent_category' USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 1000 THEN
    RAISE EXCEPTION 'description_too_long' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.money_agents (
    user_id,
    name,
    category,
    description,
    status,
    total_earned,
    runs_count
  )
  VALUES (
    v_user_id,
    v_name,
    v_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    'idle',
    0,
    0
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.moneyhub_set_agent_status(
  p_agent_id uuid,
  p_status text
)
RETURNS public.money_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_row public.money_agents;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('idle', 'running', 'paused') THEN
    RAISE EXCEPTION 'invalid_agent_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.money_agents
  SET
    status = v_status,
    last_run_at = CASE WHEN v_status = 'running' THEN now() ELSE last_run_at END
  WHERE id = p_agent_id
    AND user_id = v_user_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'money_agent_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.moneyhub_create_agent(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moneyhub_set_agent_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moneyhub_create_agent(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moneyhub_set_agent_status(uuid, text) TO authenticated;

-- Ensure MoneyHub can refresh when an agent lifecycle state changes. Avoid
-- duplicate-publication errors on projects where this table was added manually.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'money_agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.money_agents;
  END IF;
END;
$$;
