from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOUNDATION = ROOT / "supabase" / "migrations" / "20260616023000_primetime_release1_crm_foundation.sql"
ENFORCEMENT = ROOT / "supabase" / "migrations" / "20260616024500_primetime_release1_enforcement.sql"


def test_release1_foundation_tables_exist():
    sql = FOUNDATION.read_text()
    for table in [
        "workspaces",
        "roles",
        "workspace_memberships",
        "people",
        "households",
        "leads",
        "tasks",
        "activities",
        "consent_records",
        "suppression_records",
        "audit_events",
        "release_gate_exceptions",
    ]:
        assert f"create table if not exists public.{table}" in sql


def test_release1_foundation_has_rls_and_immutable_audit():
    sql = FOUNDATION.read_text()
    assert "alter table public.leads enable row level security" in sql
    assert "alter table public.audit_events enable row level security" in sql
    assert "prevent_audit_update_delete" in sql
    assert "before update or delete on public.audit_events" in sql


def test_release1_enforcement_has_pipeline_guards():
    sql = ENFORCEMENT.read_text()
    assert "validate_open_lead_required_fields" in sql
    assert "open leads require owner_user_id" in sql
    assert "open leads require next_action" in sql
    assert "record_stage_transition" in sql
    assert "update_lead_last_activity" in sql
    assert "scan_release1_lead_exceptions" in sql
    assert "seed_primetime_pipeline" in sql
