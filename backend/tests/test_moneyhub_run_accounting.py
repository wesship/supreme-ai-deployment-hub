from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260913103000_moneyhub_governed_run_accounting.sql"
ROUTER = ROOT / "backend" / "app" / "routers" / "moneyhub.py"


def test_run_rpcs_are_security_definer_and_service_role_only():
    sql = MIGRATION.read_text()
    for signature in (
        "public.moneyhub_start_agent_run(uuid,uuid,text,jsonb)",
        "public.moneyhub_finish_agent_run(uuid,uuid,text,jsonb)",
    ):
        assert f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC" in sql
        assert f"REVOKE ALL ON FUNCTION {signature} FROM anon" in sql
        assert f"REVOKE ALL ON FUNCTION {signature} FROM authenticated" in sql
        assert f"GRANT EXECUTE ON FUNCTION {signature} TO service_role" in sql
    assert sql.count("SECURITY DEFINER") == 2
    assert sql.count("SET search_path = public, pg_temp") == 2


def test_start_run_is_owned_and_idempotent():
    sql = MIGRATION.read_text()
    assert "WHERE id = p_agent_id AND user_id = p_user_id" in sql
    assert "ON CONFLICT (user_id, correlation_id) DO NOTHING" in sql
    assert "correlation_id_conflict" in sql
    assert "v_existing_agent_id IS DISTINCT FROM p_agent_id" in sql


def test_runs_count_increments_exactly_once_on_new_run():
    sql = MIGRATION.read_text()
    assert "IF v_inserted THEN" in sql
    assert "runs_count = coalesce(runs_count, 0) + 1" in sql
    assert "last_run_at = now()" in sql
    assert sql.count("runs_count = coalesce(runs_count, 0) + 1") == 1


def test_finish_run_rejects_cross_user_and_terminal_rewrites():
    sql = MIGRATION.read_text()
    assert "WHERE id = p_run_id AND user_id = p_user_id" in sql
    assert "moneyhub_run_not_found" in sql
    assert "IF v_run.status = 'started' THEN" in sql
    assert "AND status = 'started'" in sql
    assert "('completed', 'failed', 'cancelled')" in sql


def test_backend_run_endpoints_derive_user_from_verified_principal():
    source = ROUTER.read_text()
    assert '@router.post("/runs"' in source
    assert '@router.post("/runs/{run_id}/finish")' in source
    assert '"moneyhub_start_agent_run"' in source
    assert '"moneyhub_finish_agent_run"' in source
    assert source.count('"p_user_id": principal.user_id') >= 3
    assert "SUPABASE_SERVICE_ROLE_KEY" in source
