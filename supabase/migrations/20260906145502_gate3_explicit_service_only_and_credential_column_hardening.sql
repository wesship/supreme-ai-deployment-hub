-- Gate 3: make service-only posture explicit and prevent direct credential-column reads.

-- 1) Service-only tables: explicit browser denial + service_role authority.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'aquagov_workers',
    'jetson_command_audit',
    'jetson_commands',
    'jetson_devices',
    'jetson_telemetry',
    'quantum_optimization_experiments',
    'quantum_optimization_metrics'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Deny direct browser access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Deny direct browser access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- 2) Credential base tables: preserve RLS ownership, but remove secret-column SELECT.
ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON TABLE public.api_connections FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.cloud_credentials FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.mcp_connections FROM PUBLIC, anon, authenticated;

GRANT SELECT (id, user_id, service_name, auth_type, is_valid, last_validated_at, created_at, updated_at)
  ON public.api_connections TO authenticated;
GRANT SELECT (id, user_id, provider, region, is_active, last_validated_at, created_at, updated_at)
  ON public.cloud_credentials TO authenticated;
GRANT SELECT (id, user_id, server_id, server_name, server_type, gateway_url, category, custom_config, is_active, last_connected_at, created_at, updated_at)
  ON public.mcp_connections TO authenticated;

GRANT ALL ON TABLE public.api_connections, public.cloud_credentials, public.mcp_connections TO service_role;

-- 3) Safe views are authenticated-only entry points for credential metadata.
REVOKE ALL ON TABLE public.api_connections_safe FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.cloud_credentials_safe FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.mcp_connections_safe FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.api_connections_safe, public.cloud_credentials_safe, public.mcp_connections_safe TO authenticated, service_role;

-- 4) Tighten credential ownership policies to authenticated and require post-update ownership.
DROP POLICY IF EXISTS "Users can view own api connection metadata" ON public.api_connections;
CREATE POLICY "Users can view own api connection metadata"
  ON public.api_connections FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own cloud credentials" ON public.cloud_credentials;
DROP POLICY IF EXISTS "Users can insert own cloud credentials" ON public.cloud_credentials;
DROP POLICY IF EXISTS "Users can update own cloud credentials" ON public.cloud_credentials;
DROP POLICY IF EXISTS "Users can delete own cloud credentials" ON public.cloud_credentials;
CREATE POLICY "Users can view own cloud credentials"
  ON public.cloud_credentials FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own cloud credentials"
  ON public.cloud_credentials FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own cloud credentials"
  ON public.cloud_credentials FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own cloud credentials"
  ON public.cloud_credentials FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own MCP connections" ON public.mcp_connections;
DROP POLICY IF EXISTS "Users can create their own MCP connections" ON public.mcp_connections;
DROP POLICY IF EXISTS "Users can update their own MCP connections" ON public.mcp_connections;
DROP POLICY IF EXISTS "Users can delete their own MCP connections" ON public.mcp_connections;
CREATE POLICY "Users can view their own MCP connections"
  ON public.mcp_connections FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create their own MCP connections"
  ON public.mcp_connections FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own MCP connections"
  ON public.mcp_connections FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own MCP connections"
  ON public.mcp_connections FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
