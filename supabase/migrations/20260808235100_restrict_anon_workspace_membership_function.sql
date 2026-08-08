-- `is_active_workspace_member` is used by authenticated-only RLS policies.
-- Anonymous callers have no valid membership identity (`auth.uid()` is null), so
-- direct anon EXECUTE is unnecessary and expands the exposed RPC surface.

revoke execute on function public.is_active_workspace_member(uuid) from anon;
