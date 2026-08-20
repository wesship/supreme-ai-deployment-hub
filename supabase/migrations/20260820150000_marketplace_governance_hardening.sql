-- Marketplace governance hardening
-- Installation lifecycle is controlled through RPCs; runtime fields are not
-- directly writable by browser clients.

ALTER TABLE public.deployed_agents
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.deployed_agents
  DROP CONSTRAINT IF EXISTS deployed_agents_status_check;

ALTER TABLE public.deployed_agents
  ADD CONSTRAINT deployed_agents_status_check
  CHECK (status IN ('starting', 'running', 'stopped', 'paused', 'error', 'revoked', 'configuring', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_deployed_agents_template_status
  ON public.deployed_agents(template_id, status);

CREATE INDEX IF NOT EXISTS idx_deployed_agents_requested_at
  ON public.deployed_agents(requested_at DESC);

-- Browser clients must not mutate runtime-controlled installation state directly.
DROP POLICY IF EXISTS "Users can update own deployed agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Users can delete own deployed agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Users can deploy agents" ON public.deployed_agents;

CREATE POLICY "Users can create marketplace installs"
  ON public.deployed_agents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      template_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.agent_templates t
        WHERE t.id = template_id
          AND t.status = 'published'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.marketplace_install_agent(
  p_template_id UUID,
  p_name TEXT,
  p_config JSONB DEFAULT '{}'::jsonb,
  p_mcp_config JSONB DEFAULT '{"gateway_url": null, "enabled_tools": []}'::jsonb
)
RETURNS public.deployed_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.agent_templates;
  v_result public.deployed_agents;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 1 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'invalid installation name';
  END IF;

  SELECT * INTO v_template
  FROM public.agent_templates
  WHERE id = p_template_id
    AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'marketplace template is not published';
  END IF;

  INSERT INTO public.deployed_agents (
    user_id, template_id, name, config, mcp_config, status, requested_at
  )
  VALUES (
    auth.uid(), p_template_id, trim(p_name), COALESCE(p_config, '{}'::jsonb),
    COALESCE(p_mcp_config, '{"gateway_url": null, "enabled_tools": []}'::jsonb),
    'starting', now()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_update_installation_status(
  p_id UUID,
  p_status TEXT,
  p_last_error TEXT DEFAULT NULL
)
RETURNS public.deployed_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.deployed_agents;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_status NOT IN ('starting', 'running', 'stopped', 'paused', 'error', 'revoked', 'suspended') THEN
    RAISE EXCEPTION 'invalid installation status';
  END IF;

  UPDATE public.deployed_agents
  SET status = p_status,
      last_error = NULLIF(trim(COALESCE(p_last_error, '')), ''),
      last_heartbeat = CASE WHEN p_status = 'running' THEN now() ELSE last_heartbeat END,
      verified_at = CASE WHEN p_status = 'running' THEN COALESCE(verified_at, now()) ELSE verified_at END,
      updated_at = now()
  WHERE id = p_id
    AND user_id = auth.uid()
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'installation not found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_uninstall_agent(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  DELETE FROM public.deployed_agents
  WHERE id = p_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_deleted = ROW_COUNT > 0;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_install_agent(UUID, TEXT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_update_installation_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_uninstall_agent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_install_agent(UUID, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_update_installation_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_agent(UUID) TO authenticated;
