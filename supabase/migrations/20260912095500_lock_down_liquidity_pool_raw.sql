-- Raw liquidity snapshots may contain provider payloads and are service-owned.
-- The table is created by a managed deployment outside this repository in some
-- environments, so the migration is intentionally a safe no-op when absent.
DO $$
BEGIN
    IF to_regclass('public.liquidity_pool_raw') IS NOT NULL THEN
        ALTER TABLE public.liquidity_pool_raw ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public.liquidity_pool_raw FROM PUBLIC, anon, authenticated;
        GRANT ALL ON TABLE public.liquidity_pool_raw TO service_role;
    END IF;
END
$$;
