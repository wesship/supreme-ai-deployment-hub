-- Compatibility shim for a historical usage-logging RPC that is absent
-- from current staging and production. Preserve the signature as a no-op so
-- privilege hardening can replay without writing unexpected audit data.

CREATE OR REPLACE FUNCTION public.log_api_usage(
  event_type_in text,
  details_in jsonb
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT;
$$;
