-- Compatibility shim for a historical privilege-hardening migration.
-- The legacy first-admin bootstrap RPC is absent from current staging and
-- production. Keep the compatibility signature fail-closed so replaying the
-- migration chain cannot grant administrative privileges.

CREATE OR REPLACE FUNCTION public.claim_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT false;
$$;
