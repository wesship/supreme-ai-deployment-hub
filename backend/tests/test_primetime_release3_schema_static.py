from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718161500_primetime_release3_communications.sql"

REQUIRED_TABLES = [
    "primetime_communication_preferences",
    "primetime_message_templates",
    "primetime_template_versions",
    "primetime_communications",
    "primetime_communication_events",
    "primetime_voice_call_records",
]

RLS_TABLES = REQUIRED_TABLES  # all communications tables are tenant-scoped


def test_release3_schema_contains_required_tables():
    sql = MIGRATION.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release3_schema_enables_rls():
    sql = MIGRATION.read_text().lower()
    for table in RLS_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release3_schema_has_transactional_wrapper():
    sql = MIGRATION.read_text().lower()
    assert "begin;" in sql
    assert "commit;" in sql


def test_release3_templates_have_draft_first_status():
    sql = MIGRATION.read_text()
    assert "'draft'" in sql
    assert "'approved'" in sql
    assert "'pending_review'" in sql


def test_release3_outbound_policy_enforcement_trigger():
    sql = MIGRATION.read_text().lower()
    assert "primetime_enforce_outbound_policy" in sql
    assert "primetime_communications_outbound_policy" in sql


def test_release3_communications_require_policy_fields():
    sql = MIGRATION.read_text()
    assert "consent_verified" in sql
    assert "suppression_checked" in sql
    assert "policy_check_passed" in sql
