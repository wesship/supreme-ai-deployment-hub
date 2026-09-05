-- Gate 2-R3: explicitly restrict SECURITY DEFINER RPC execution.
-- All functions below either require auth.uid() or scope reads to auth.uid().
-- Remove implicit PUBLIC/anon execution and allow authenticated/service_role only.

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_cloud_credential_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cloud_credential_safe(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_connection_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connection_safe(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_valid_connection(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_valid_connection(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_cloud_credentials() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_cloud_credentials() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_mcp_connections_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_mcp_connections_safe() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_user_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_connections() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.primetime_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.primetime_workspace_member(uuid) TO authenticated, service_role;
