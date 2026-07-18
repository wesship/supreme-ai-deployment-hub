from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718170000_primetime_release6_production_hardening.sql"

REQUIRED_TABLES = [
    "primetime_compliance_rules",
    "primetime_release_gates",
    "primetime_data_quality_exceptions",
    "primetime_system_health_events",
]

# primetime_compliance_rules is a global reference table (like primetime_roles);
# RLS is intentionally omitted. All other tables are tenant-scoped.
RLS_TABLES = [t for t in REQUIRED_TABLES if t != "primetime_compliance_rules"]

NON_NEGOTIABLE_RULE_CODES = [
    "NO_LEAD_WITHOUT_OWNER",
    "NO_OPEN_OPP_WITHOUT_NEXT_ACTION",
    "NO_COMM_WITHOUT_CONSENT",
    "NO_AI_WITHOUT_AUDIT",
    "NO_REGULATED_REC_WITHOUT_HUMAN",
    "NO_STATE_ONLY_IN_N8N",
    "NO_UNAPPROVED_TEMPLATE",
    "NO_EXPIRED_KNOWLEDGE_SOURCE",
    "NO_SENSITIVE_EXPORT_WITHOUT_AUTH",
]


def test_release6_schema_contains_required_tables():
    sql = MIGRATION.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release6_schema_enables_rls():
    sql = MIGRATION.read_text().lower()
    for table in RLS_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release6_schema_has_transactional_wrapper():
    sql = MIGRATION.read_text().lower()
    assert "begin;" in sql
    assert "commit;" in sql


def test_release6_seeds_all_non_negotiable_rules():
    sql = MIGRATION.read_text()
    for code in NON_NEGOTIABLE_RULE_CODES:
        assert code in sql


def test_release6_release_gates_are_append_only():
    sql = MIGRATION.read_text().lower()
    assert "primetime_prevent_release_gate_deletion" in sql
    assert "primetime_release_gates_no_delete" in sql


def test_release6_records_migration_as_health_event():
    sql = MIGRATION.read_text()
    assert "migration_applied" in sql
    assert "Release 6" in sql
