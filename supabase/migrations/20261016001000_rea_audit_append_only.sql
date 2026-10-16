-- REA Gate 8: harden the audit ledger against UPDATE and DELETE.
-- Only INSERT/SELECT may be granted to the dedicated service role in a later
-- reviewed deployment. Table ownership and migration privileges remain trusted.
-- This trigger protects rows even if a privileged application role is mistakenly
-- granted UPDATE/DELETE. Superusers and table owners can still change DDL.
CREATE OR REPLACE FUNCTION public.rea_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'REA audit events are append-only'
        USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.rea_reject_audit_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rea_audit_append_only ON public.rea_admission_audit;
CREATE TRIGGER rea_audit_append_only
BEFORE UPDATE OR DELETE ON public.rea_admission_audit
FOR EACH ROW EXECUTE FUNCTION public.rea_reject_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.rea_admission_audit FROM PUBLIC, anon, authenticated, service_role;
-- No grant to service_role here: authorization and audited writer contract
-- must be implemented and reviewed separately.
