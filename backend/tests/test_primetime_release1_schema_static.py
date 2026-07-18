from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "supabase" / "migrations" / "20260718150000_primetime_release1_crm_foundation.sql"
ENFORCEMENT = ROOT / "supabase" / "migrations" / "20260718151500_primetime_release1_enforcement.sql"

REQUIRED_TABLES = [
    "primetime_workspaces",
    "primetime_roles",
    "primetime_workspace_memberships",
    "primetime_people",
    "primetime_households",
    "primetime_household_members",
    "primetime_pipeline_stages",
    "primetime_leads",
    "primetime_stage_transitions",
    "primetime_tasks",
    "primetime_activities",
    "primetime_consent_records",
    "primetime_suppression_records",
    "primetime_audit_events",
    "primetime_release_exceptions",
]


def test_release1_schema_contains_required_tables():
    sql = SCHEMA.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release1_schema_enables_rls():
    sql = SCHEMA.read_text().lower()
    for table in REQUIRED_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release1_enforcement_has_required_controls():
    sql = ENFORCEMENT.read_text().lower()
    assert "primetime_prevent_audit_mutation" in sql
    assert "primetime_record_stage_transition" in sql
    assert "primetime_update_lead_last_activity" in sql
    assert "primetime_seed_pipeline_stages" in sql
    assert "primetime_scan_release1_exceptions" in sql
