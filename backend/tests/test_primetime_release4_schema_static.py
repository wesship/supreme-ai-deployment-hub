from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718163000_primetime_release4_ai_assistance.sql"

REQUIRED_TABLES = [
    "primetime_ai_agents",
    "primetime_ai_actions",
    "primetime_ai_approval_requests",
    "primetime_knowledge_sources",
    "primetime_knowledge_versions",
    "primetime_compliance_checks",
]

RLS_TABLES = REQUIRED_TABLES  # all AI assistance tables are tenant-scoped


def test_release4_schema_contains_required_tables():
    sql = MIGRATION.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release4_schema_enables_rls():
    sql = MIGRATION.read_text().lower()
    for table in RLS_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release4_schema_has_transactional_wrapper():
    sql = MIGRATION.read_text().lower()
    assert "begin;" in sql
    assert "commit;" in sql


def test_release4_ai_actions_require_audit_event_trigger():
    sql = MIGRATION.read_text().lower()
    assert "primetime_require_ai_audit_event" in sql
    assert "primetime_ai_actions_require_audit" in sql


def test_release4_ai_actions_have_approval_gate():
    sql = MIGRATION.read_text()
    assert "requires_approval" in sql
    assert "awaiting_approval" in sql
    assert "approved_by" in sql
    assert "rejected_by" in sql


def test_release4_knowledge_sources_have_approval_lifecycle():
    sql = MIGRATION.read_text()
    assert "'draft'" in sql
    assert "'approved'" in sql
    assert "'expired'" in sql
    assert "expires_at" in sql
