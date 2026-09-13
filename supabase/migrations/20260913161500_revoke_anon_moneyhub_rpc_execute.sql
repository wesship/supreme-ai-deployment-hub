-- Lock the MoneyHub mutation RPCs to authenticated callers only.
-- Production and staging previously had explicit anon EXECUTE ACLs despite
-- the earlier migration revoking PUBLIC.

REVOKE ALL ON FUNCTION public.moneyhub_create_agent(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.moneyhub_create_agent(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.moneyhub_set_agent_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.moneyhub_set_agent_status(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.moneyhub_create_agent(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moneyhub_set_agent_status(uuid, text) TO authenticated;
