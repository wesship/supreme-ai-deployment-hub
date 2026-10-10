-- Audit + portability controls for sensitive support context.

CREATE SCHEMA IF NOT EXISTS support_private;
REVOKE ALL ON SCHEMA support_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.support_context_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  target_table text NOT NULL CHECK (target_table IN ('support_journal_records', 'support_screening_records')),
  target_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS support_context_audit_user_idx ON public.support_context_audit_events(user_id);
CREATE INDEX IF NOT EXISTS support_context_audit_tenant_user_idx ON public.support_context_audit_events(tenant_id, user_id);

ALTER TABLE public.support_context_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_context_audit_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.support_context_audit_events TO authenticated;

CREATE POLICY "support audit select own tenant" ON public.support_context_audit_events FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id AND (select auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id);

CREATE OR REPLACE FUNCTION support_private.write_context_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id text;
  v_user_id uuid;
  v_target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_user_id := OLD.user_id;
    v_target_id := OLD.id;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_user_id := NEW.user_id;
    v_target_id := NEW.id;
  END IF;

  INSERT INTO public.support_context_audit_events (
    tenant_id, user_id, event_type, target_table, target_id, metadata
  ) VALUES (
    v_tenant_id, v_user_id, TG_OP, TG_TABLE_NAME, v_target_id,
    jsonb_build_object('source', 'database-trigger')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION support_private.write_context_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS support_journal_audit_trigger ON public.support_journal_records;
CREATE TRIGGER support_journal_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.support_journal_records
FOR EACH ROW EXECUTE FUNCTION support_private.write_context_audit_event();

DROP TRIGGER IF EXISTS support_screening_audit_trigger ON public.support_screening_records;
CREATE TRIGGER support_screening_audit_trigger
AFTER INSERT OR DELETE ON public.support_screening_records
FOR EACH ROW EXECUTE FUNCTION support_private.write_context_audit_event();

CREATE OR REPLACE FUNCTION public.support_export_my_context()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  SELECT jsonb_build_object(
    'tenant_id', (select auth.jwt()->'app_metadata'->>'tenant_id'),
    'user_id', (select auth.uid()),
    'journals', COALESCE((SELECT jsonb_agg(to_jsonb(j) ORDER BY j.created_at) FROM public.support_journal_records j), '[]'::jsonb),
    'screenings', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM public.support_screening_records s), '[]'::jsonb),
    'audit_events', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.occurred_at) FROM public.support_context_audit_events a), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.support_export_my_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_export_my_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.support_delete_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_journals integer := 0;
  v_screenings integer := 0;
BEGIN
  DELETE FROM public.support_journal_records;
  GET DIAGNOSTICS v_journals = ROW_COUNT;

  DELETE FROM public.support_screening_records;
  GET DIAGNOSTICS v_screenings = ROW_COUNT;

  RETURN jsonb_build_object('journals_deleted', v_journals, 'screenings_deleted', v_screenings);
END;
$$;
REVOKE ALL ON FUNCTION public.support_delete_my_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_delete_my_context() TO authenticated;
