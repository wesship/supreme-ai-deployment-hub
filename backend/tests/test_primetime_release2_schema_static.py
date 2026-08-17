from pathlib import Path

MIGRATION = Path('supabase/migrations/20260721141622_restore_primetime_governed_runtime_schema.sql')
PLAN = Path('docs/PRIMETIME_RELEASE2_SCHEDULING_PLAN.md')
CONTRACT = Path('docs/PRIMETIME_RELEASE2_API_CONTRACT.md')


def test_release2_scheduling_migration_exists():
    assert MIGRATION.exists(), 'Release 2 scheduling migration must exist'


def test_release2_required_tables_are_declared():
    text = MIGRATION.read_text()
    for table in [
        'public.appointments',
        'public.appointment_attendees',
        'public.availability_rules',
        'public.reminders',
        'public.no_show_events',
        'public.calendar_sync_events',
    ]:
        assert f'create table if not exists {table}' in text


def test_release2_appointment_controls_exist():
    text = MIGRATION.read_text()
    assert 'primetime_enforce_appointment_controls' in text
    assert 'Open appointment requires an owner' in text
    assert 'Open appointment requires a valid time range' in text
    assert 'Blocked appointment cannot be scheduled' in text
    assert 'check (end_at > start_at)' in text


def test_release2_no_show_recovery_exists():
    text = MIGRATION.read_text()
    assert 'primetime_after_appointment_status_change' in text
    assert "new.status = 'no_show'" in text
    assert 'Recover no-show appointment' in text
    assert 'public.no_show_events' in text


def test_release2_calendar_sync_is_boundary_not_authority():
    migration = MIGRATION.read_text()
    contract = CONTRACT.read_text()
    assert 'calendar_sync_events' in migration
    assert 'provider_event_id' in migration
    assert 'non-authoritative' in contract.lower()
    assert 'may never overwrite appointment state' in contract


def test_release2_rls_and_workspace_membership_policies_exist():
    text = MIGRATION.read_text()
    for table in [
        'appointments',
        'appointment_attendees',
        'availability_rules',
        'reminders',
        'no_show_events',
        'calendar_sync_events',
    ]:
        assert f'alter table public.{table} enable row level security' in text
        assert f'{table}_workspace_members' in text


def test_release2_docs_exist_and_define_exit_gate():
    assert PLAN.exists()
    assert CONTRACT.exists()
    plan = PLAN.read_text()
    assert 'Release 2 exit gate' in plan
    assert 'no-show appointment creates a recovery task' in plan
    assert 'calendar sync writes integration events' in plan
