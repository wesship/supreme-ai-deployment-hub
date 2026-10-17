from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260929113000_moneyhub_governed_provider_ingestion.sql"
ROUTER = ROOT / "backend" / "app" / "routers" / "moneyhub.py"


def test_governed_ingestion_rpc_is_service_role_only():
    sql = MIGRATION.read_text()
    signature = "public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb)"
    assert f"revoke all on function {signature} from public" in sql
    assert f"revoke all on function {signature} from anon" in sql
    assert f"revoke all on function {signature} from authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql


def test_governed_ingestion_enforces_idempotency_and_pending_to_posted_reconciliation():
    sql = MIGRATION.read_text()
    assert "v_idempotency_key" in sql
    assert "v_existing_status = 'pending' and (v_txn->>'status') = 'posted'" in sql
    assert "transactions_reconciled" in sql
    assert "transactions_duplicate" in sql
    assert "moneyhub_account_not_found" in sql
    assert "moneyhub_provider_mismatch" in sql


def test_governed_ingestion_route_is_storage_only():
    source = ROUTER.read_text()
    assert '@router.post("/financial-sources/ingest")' in source
    assert '"storage_only": True' in source
    assert '"transfers": False' in source
    assert '"payments": False' in source
    assert '"withdrawals": False' in source
    assert '"brokerage_execution": False' in source
    assert '"lending_decisions": False' in source


def test_governed_ingestion_uses_validated_provider_batch_contract():
    source = ROUTER.read_text()
    assert "from backend.moneyhub.adapters import ProviderBatch" in source
    assert "payload: ProviderBatch" in source
    assert '"moneyhub_ingest_provider_batch"' in source
    assert '"p_user_id": principal.user_id' in source
