-- Gate 3 tenant-isolation hardening.
--
-- The previous ALL policy allowed any authenticated user to insert a membership
-- for themselves into an arbitrary workspace because user_id = auth.uid() was
-- sufficient for WITH CHECK. Membership mutation must instead happen through
-- audited privileged flows such as create_workspace / invitation acceptance or
-- trusted backend service-role operations.
--
-- Drop both policy names so the migration is safe when replayed against a
-- staging environment where the emergency hardening was already applied.

DROP POLICY IF EXISTS "Primetime workspace members"
ON public.primetime_workspace_memberships;

DROP POLICY IF EXISTS "Primetime workspace members can read memberships"
ON public.primetime_workspace_memberships;

CREATE POLICY "Primetime workspace members can read memberships"
ON public.primetime_workspace_memberships
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.primetime_workspace_member(workspace_id)
);
