-- MoneyHub governed run accounting
-- Server-owned, idempotent execution lifecycle for MoneyHub agents.

CREATE OR REPLACE FUNCTION public.moneyhub_start_agent_run(
  p_user_id uuid,
  p_agent_id uuid,
  p_correlation_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_correlation_id text := btrim(coalesce(p_correlation_id, ''));
  v_run_id uuid;
  v_existing_agent_id uuid;
  v_inserted boolean := false;
BEGIN
  IF v_correlation_id = '' THEN
    RAISE EXCEPTION 'missing_correlation_id' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.money_agents
    WHERE id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'money_agent_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.moneyhub_agent_runs (
    agent_id, user_id, correlation_id, status, metadata
  ) VALUES (
    p_agent_id, p_user_id, v_correlation_id, 'started', coalesce(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, correlation_id) DO NOTHING
  RETURNING id INTO v_run_id;

  v_inserted := v_run_id IS NOT NULL;

  IF v_inserted THEN
    UPDATE public.money_agents
    SET runs_count = coalesce(runs_count, 0) + 1,
        last_run_at = now()
    WHERE id = p_agent_id AND user_id = p_user_id;
  ELSE
    SELECT id, agent_id
      INTO v_run_id, v_existing_agent_id
    FROM public.moneyhub_agent_runs
    WHERE user_id = p_user_id AND correlation_id = v_correlation_id;

    IF v_existing_agent_id IS DISTINCT FROM p_agent_id THEN
      RAISE EXCEPTION 'correlation_id_conflict' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_run_id,
    'inserted', v_inserted,
    'status', 'started'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moneyhub_finish_agent_run(
  p_user_id uuid,
  p_run_id uuid,
  p_status text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_run public.moneyhub_agent_runs%ROWTYPE;
  v_finished boolean := false;
BEGIN
  IF v_status NOT IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_run_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.moneyhub_agent_runs
  WHERE id = p_run_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'moneyhub_run_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_run.status = 'started' THEN
    UPDATE public.moneyhub_agent_runs
    SET status = v_status,
        finished_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
    WHERE id = p_run_id AND user_id = p_user_id AND status = 'started'
    RETURNING * INTO v_run;
    v_finished := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'id', v_run.id,
    'finished', v_finished,
    'status', v_run.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moneyhub_start_agent_run(uuid,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moneyhub_start_agent_run(uuid,uuid,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.moneyhub_start_agent_run(uuid,uuid,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.moneyhub_start_agent_run(uuid,uuid,text,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.moneyhub_finish_agent_run(uuid,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moneyhub_finish_agent_run(uuid,uuid,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.moneyhub_finish_agent_run(uuid,uuid,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.moneyhub_finish_agent_run(uuid,uuid,text,jsonb) TO service_role;
