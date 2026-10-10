-- `is_active_workspace_member` is used by authenticated-only RLS policies.
-- Anonymous callers have no valid membership identity (`auth.uid()` is null), so
-- direct anon EXECUTE is unnecessary and expands the exposed RPC surface.
--
-- Some clean/preview databases do not yet contain the helper because its canonical
-- creation is not represented in this repository's migration history. Keep this
-- hardening migration replay-safe: revoke only when the function actually exists.

do $$
begin
  if to_regprocedure('public.is_active_workspace_member(uuid)') is not null then
    revoke execute on function public.is_active_workspace_member(uuid) from anon;
  end if;
end
$$;
