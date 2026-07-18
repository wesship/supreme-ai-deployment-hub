from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718164500_primetime_release5_analytics.sql"

REQUIRED_TABLES = [
    "primetime_analytics_snapshots",
    "primetime_analytics_metrics",
    "primetime_analytics_reports",
]

RLS_TABLES = REQUIRED_TABLES  # all analytics tables are tenant-scoped


def test_release5_schema_contains_required_tables():
    sql = MIGRATION.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release5_schema_enables_rls():
    sql = MIGRATION.read_text().lower()
    for table in RLS_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release5_schema_has_transactional_wrapper():
    sql = MIGRATION.read_text().lower()
    assert "begin;" in sql
    assert "commit;" in sql


def test_release5_snapshots_are_immutable():
    sql = MIGRATION.read_text().lower()
    assert "primetime_prevent_snapshot_mutation" in sql
    assert "primetime_analytics_snapshots_immutable" in sql


def test_release5_snapshots_have_required_types():
    sql = MIGRATION.read_text()
    assert "pipeline_summary" in sql
    assert "activity_summary" in sql
    assert "communication_summary" in sql
    assert "appointment_summary" in sql
    assert "ai_action_summary" in sql
