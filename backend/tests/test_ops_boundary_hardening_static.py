from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20260725022000_harden_ops_boundary_and_ai_film_search_path.sql"
)


def test_operations_tables_revoke_browser_role_privileges() -> None:
    text = MIGRATION.read_text(encoding="utf-8").lower()

    for table in (
        "ops_health_checks",
        "ops_incidents",
        "ops_alerts",
        "ops_remediations",
        "ops_approvals",
        "ops_audit_events",
    ):
        assert f"public.{table}" in text

    assert "revoke all privileges on table" in text
    assert "from public, anon, authenticated" in text


def test_security_definer_rpc_is_service_role_only() -> None:
    text = MIGRATION.read_text(encoding="utf-8").lower()
    signature = "public.ops_open_incident(text, text, text, text, text, jsonb)"

    assert f"revoke execute on function {signature}" in text
    assert f"grant execute on function {signature}" in text
    assert "to service_role" in text


def test_ai_film_trigger_has_fixed_search_path() -> None:
    text = MIGRATION.read_text(encoding="utf-8").lower()

    assert "alter function public.ai_film_touch_updated_at()" in text
    assert "set search_path = pg_catalog, public" in text
