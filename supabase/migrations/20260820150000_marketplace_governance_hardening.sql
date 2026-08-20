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

CREATE TABLE IF NOT EXISTS public.marketplace_installation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID,
  actor_id UUID,
  event_type TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_installation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketplace installation events"
  ON public.marketplace_installation_events FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_marketplace_installation_events_installation
  ON public.marketplace_installation_events(installation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.marketplace_record_installation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.marketplace_installation_events (
    installation_id, actor_id, event_type, before_state, after_state
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'installed' WHEN 'UPDATE' THEN 'updated' ELSE 'uninstalled' END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS marketplace_installation_audit ON public.deployed_agents;
CREATE TRIGGER marketplace_installation_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deployed_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.marketplace_record_installation_event();

-- Browser clients cannot directly insert/update/delete installation rows.
DROP POLICY IF EXISTS "Users can update own deployed agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Users can delete own deployed agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Users can deploy agents" ON public.deployed_agents;
DROP POLICY IF EXISTS "Users can create marketplace installs" ON public.deployed_agents;

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
  v_result public.deployed_agents;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 1 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'invalid installation name';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.agent_templates
    WHERE id = p_template_id AND status = 'published'
  ) THEN
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
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  DELETE FROM public.deployed_agents
  WHERE id = p_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_install_agent(UUID, TEXT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_update_installation_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_uninstall_agent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_install_agent(UUID, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_update_installation_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_agent(UUID) TO authenticated;
