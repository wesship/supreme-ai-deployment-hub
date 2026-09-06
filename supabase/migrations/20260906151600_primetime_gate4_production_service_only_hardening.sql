-- PRIMETIME Gate 4: production-compatible service-only hardening.
--
-- Production does not contain every object present in the Gate 3 staging schema.
-- This migration intentionally targets only the six service-only tables that exist
-- in the current production schema and is idempotent/safe if an object is absent.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'jetson_command_audit',
    'jetson_commands',
    'jetson_devices',
    'jetson_telemetry',
    'quantum_optimization_experiments',
    'quantum_optimization_metrics'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Gate 4: skipping missing table public.%', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Deny direct browser access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Deny direct browser access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

COMMENT ON POLICY "Deny direct browser access" ON public.jetson_command_audit
  IS 'PRIMETIME Gate 4: service-role-only control-plane data; direct browser access denied.';
COMMENT ON POLICY "Deny direct browser access" ON public.jetson_commands
  IS 'PRIMETIME Gate 4: service-role-only control-plane data; direct browser access denied.';
COMMENT ON POLICY "Deny direct browser access" ON public.jetson_devices
  IS 'PRIMETIME Gate 4: service-role-only control-plane data; direct browser access denied.';
COMMENT ON POLICY "Deny direct browser access" ON public.jetson_telemetry
  IS 'PRIMETIME Gate 4: service-role-only control-plane data; direct browser access denied.';
COMMENT ON POLICY "Deny direct browser access" ON public.quantum_optimization_experiments
  IS 'PRIMETIME Gate 4: service-role-only optimization data; direct browser access denied.';
COMMENT ON POLICY "Deny direct browser access" ON public.quantum_optimization_metrics
  IS 'PRIMETIME Gate 4: service-role-only optimization data; direct browser access denied.';
