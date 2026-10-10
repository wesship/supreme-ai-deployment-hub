-- Defense-in-depth: revoke anon EXECUTE on all SECURITY DEFINER functions.
-- Behavior unchanged — every fn still gates internally on auth.uid().

-- Trigger / internal helpers: no API caller should ever invoke these
REVOKE EXECUTE ON FUNCTION public.update_workflow_timestamp()       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_persona_timestamp()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_conversation_timestamp()    FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.encrypt_credentials(jsonb, text)   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrypt_credentials(bytea, text)   FROM anon, authenticated, public;

-- Authenticated-only RPCs (used by the app, never anon)
REVOKE EXECUTE ON FUNCTION public.claim_first_admin(uuid)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_user_connections()            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_connection_safe(uuid)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_cloud_credentials()           FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cloud_credential_safe(uuid)    FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_mcp_connections_safe()        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_valid_connection(text)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_api_usage(text, jsonb)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                     FROM anon, public;

GRANT EXECUTE ON FUNCTION public.claim_first_admin(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_connections()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_safe(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cloud_credentials()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cloud_credential_safe(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mcp_connections_safe()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_connection(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_api_usage(text, jsonb)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                      TO authenticated;