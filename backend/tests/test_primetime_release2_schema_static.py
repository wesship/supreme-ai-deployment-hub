from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260718160000_primetime_release2_scheduling.sql"

REQUIRED_TABLES = [
    "primetime_availability_rules",
    "primetime_appointments",
    "primetime_appointment_attendees",
    "primetime_reminders",
    "primetime_no_show_events",
]

RLS_TABLES = REQUIRED_TABLES  # all scheduling tables are tenant-scoped


def test_release2_schema_contains_required_tables():
    sql = MIGRATION.read_text()
    for table in REQUIRED_TABLES:
        assert f"public.{table}" in sql


def test_release2_schema_enables_rls():
    sql = MIGRATION.read_text().lower()
    for table in RLS_TABLES:
        assert f"alter table public.{table} enable row level security" in sql


def test_release2_schema_has_transactional_wrapper():
    sql = MIGRATION.read_text().lower()
    assert "begin;" in sql
    assert "commit;" in sql


def test_release2_appointments_status_constraint():
    sql = MIGRATION.read_text()
    assert "scheduled" in sql
    assert "confirmed" in sql
    assert "completed" in sql
    assert "no_show" in sql


def test_release2_no_show_events_link_to_recovery_task():
    sql = MIGRATION.read_text()
    assert "recovery_task_id" in sql
