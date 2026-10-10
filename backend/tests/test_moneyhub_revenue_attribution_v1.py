from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260909170000_moneyhub_revenue_attribution_v1.sql"
ROUTER = ROOT / "backend" / "app" / "routers" / "moneyhub.py"
REGISTRY = ROOT / "backend" / "app" / "routers" / "__init__.py"


def test_economic_event_tables_are_server_owned():
    sql = MIGRATION.read_text()
    for table in ("moneyhub_agent_runs", "moneyhub_revenue_events", "moneyhub_cost_events"):
        assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY" in sql
        assert f"REVOKE INSERT, UPDATE, DELETE ON public.{table} FROM authenticated" in sql
        assert f"GRANT SELECT ON public.{table} TO authenticated" in sql


def test_provider_events_are_idempotent():
    sql = MIGRATION.read_text()
    assert sql.count("UNIQUE (provider, provider_event_id)") == 2
    assert sql.count("ON CONFLICT (provider, provider_event_id) DO NOTHING") == 2


def test_economic_event_rpc_is_service_role_only():
    sql = MIGRATION.read_text()
    signature = "public.moneyhub_record_economic_event(text,uuid,uuid,text,text,text,numeric,text,text,text,uuid,jsonb,timestamptz)"
    assert f"REVOKE ALL ON FUNCTION {signature} FROM authenticated" in sql
    assert f"GRANT EXECUTE ON FUNCTION {signature} TO service_role" in sql
    assert "SECURITY DEFINER" in sql
    assert "SET search_path = public, pg_temp" in sql


def test_verified_revenue_updates_agent_earnings_once():
    sql = MIGRATION.read_text()
    assert "IF v_inserted AND v_status IN ('verified','settled')" in sql
    assert "SET total_earned = coalesce(total_earned,0) + p_amount" in sql


def test_backend_ingestion_uses_authenticated_operator_identity():
    source = ROUTER.read_text()
    assert "principal: OCCAccess" in source
    assert '"p_user_id": principal.user_id' in source
    assert "SUPABASE_SERVICE_ROLE_KEY" in source
    assert "/rest/v1/rpc/moneyhub_record_economic_event" in source


def test_moneyhub_router_is_registered():
    source = REGISTRY.read_text()
    assert "backend.app.routers.moneyhub" in source
    assert "MoneyHub economic ingestion registered at /api/moneyhub/*" in source
