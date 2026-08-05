-- Compatibility shim for a legacy privilege-hardening migration.
-- The RPC is absent from current production and staging, and has no runtime callers.
-- Fail closed so restoring its signature cannot grant administrator access.

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT false;
$$;
