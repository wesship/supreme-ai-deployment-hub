from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER = (ROOT / "backend/moneyhub/integrations_router.py").read_text()
MIGRATION = (ROOT / "supabase/migrations/20260811232500_moneyhub_runtime_cost_ingestion.sql").read_text()
INIT = (ROOT / "backend/moneyhub/__init__.py").read_text()


def test_provider_location_and_credentials_are_server_configuration_only():
    lowered = ROUTER.lower()
    assert 'os.getenv("moneyhub_market_data_url"' in lowered
    assert 'os.getenv("moneyhub_market_data_api_key"' in lowered
    assert "https" in lowered
    assert "follow_redirects=false" in lowered
    # Caller supplies symbols only; no provider URL/key/trust-tier request model exists.
    assert "market_data_url:" not in lowered
    assert "market_data_api_key:" not in lowered
    assert "trust_tier:" not in lowered


def test_provider_sync_cannot_become_live_execution():
    lowered = ROUTER.lower()
    assert 'mode: str = "simulation_only"' in lowered
    assert "moneyhub_ingest_market_quotes" in lowered
    assert "broker" in lowered  # only the explicit module safety statement
    assert "withdrawals" in lowered  # only the explicit module safety statement
    assert "moneyhub_paper_execute_order" not in lowered


def test_hermes_runtime_cost_ingestion_is_exactly_once():
    lowered = MIGRATION.lower()
    assert "unique(owner_id, source_system, source_ref)" in lowered
    assert "pg_advisory_xact_lock" in lowered
    assert "created',false" in lowered
    assert "created',true" in lowered
    assert "moneyhub_attribution_events" in lowered


def test_runtime_cost_rpc_is_service_role_only():
    lowered = MIGRATION.lower()
    assert "revoke all on function public.moneyhub_ingest_runtime_cost" in lowered
    assert "from public,anon,authenticated" in lowered
    assert "to service_role" in lowered


def test_hermes_sync_requires_internal_key_and_terminal_run():
    lowered = ROUTER.lower()
    assert "x-moneyhub-internal-key" in lowered
    assert "moneyhub_internal_ingest_key" in lowered
    assert '"completed", "failed", "cancelled"' in lowered
    assert "cost_usd" in lowered


def test_integrations_router_is_registered():
    assert "from backend.moneyhub.integrations_router import router as integrations_router" in INIT
    assert "router.include_router(integrations_router)" in INIT
