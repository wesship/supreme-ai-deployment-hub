from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260722233500_supabase_rls_phase2a_backend_only.sql"
)

EXPECTED_TABLES = {
    "ai_action_ledger",
    "ai_approval_requests",
    "ai_assistance_requests",
    "ai_assistance_outputs",
    "ai_compliance_findings",
    "ai_agents",
    "ai_agent_versions",
    "primetime_workspaces",
    "primetime_workspace_memberships",
    "primetime_roles",
    "primetime_people",
    "primetime_households",
    "primetime_household_members",
    "primetime_leads",
    "primetime_tasks",
    "primetime_activities",
    "primetime_ai_actions",
    "primetime_ai_agents",
    "primetime_audit_events",
    "primetime_consent_records",
    "primetime_suppression_records",
    "primetime_release_exceptions",
}

DEFERRED_PRODUCTION_DRIFT_TABLES = {
    "approval_requests",
    "rag_document_logs",
}

ACTIVE_OCC_TABLES = {
    "approval_queue",
    "rag_documents",
}


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_phase2a_migration_is_append_only_file() -> None:
    assert MIGRATION.exists()
    assert MIGRATION.name.startswith("20260722233500_")


def test_phase2a_migration_covers_expected_tables() -> None:
    sql = _sql()
    for table in EXPECTED_TABLES:
        assert f"'{table}'" in sql


def test_phase2a_migration_enforces_backend_only_boundary() -> None:
    sql = _sql().lower()
    assert "enable row level security" in sql
    assert "revoke all privileges on table" in sql
    assert "from public, anon, authenticated" in sql
    assert "grant all privileges on table" in sql
    assert "to service_role" in sql
    assert "deny direct browser access" in sql
    assert "for all to anon, authenticated using (false) with check (false)" in sql


def test_phase2a_migration_is_idempotent_and_schema_drift_safe() -> None:
    sql = _sql().lower()
    assert "to_regclass" in sql
    assert "drop policy if exists" in sql
    assert "begin;" in sql
    assert "commit;" in sql


def test_phase2a_defers_unreproducible_production_drift_tables() -> None:
    sql = _sql()
    for table in DEFERRED_PRODUCTION_DRIFT_TABLES:
        assert f"'{table}'" not in sql


def test_phase2a_does_not_modify_active_occ_tables() -> None:
    sql = _sql()
    for table in ACTIVE_OCC_TABLES:
        assert f"'{table}'" not in sql
