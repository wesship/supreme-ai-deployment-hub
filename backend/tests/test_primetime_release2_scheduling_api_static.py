from pathlib import Path

ROUTER = Path("backend/app/routers/primetime_release2_scheduling.py")
MAIN = Path("backend/main.py")


def test_release2_scheduling_router_exists_and_is_mounted():
    assert ROUTER.exists(), "Release 2 scheduling API router must exist"
    main = MAIN.read_text()
    assert "backend.app.routers.primetime_release2_scheduling" in main
    assert "primetime_release2_scheduling_router" in main
    assert "PRIMETIME Release 2 scheduling router registered at /primetime/v1" in main


def test_release2_scheduling_router_exposes_required_prefix_and_endpoints():
    text = ROUTER.read_text()
    assert 'prefix="/primetime/v1"' in text
    for route in [
        '/appointments',
        '/appointments/{appointment_id}',
        '/availability-rules',
        '/appointment-attendees',
        '/reminders',
        '/no-show-events',
        '/calendar-sync-events',
    ]:
        assert route in text


def test_release2_scheduling_uses_fixed_table_allowlist_and_workspace_guard():
    text = ROUTER.read_text()
    assert '_ALLOWED_TABLES = frozenset' in text
    for table in [
        'appointments',
        'appointment_attendees',
        'availability_rules',
        'reminders',
        'no_show_events',
        'calendar_sync_events',
        'workspace_memberships',
        'audit_events',
    ]:
        assert table in text
    assert '_membership_required' in text
    assert 'Workspace access required' in text


def test_release2_scheduling_validates_security_and_roles():
    text = ROUTER.read_text()
    assert 'supabase\\.co|supabase\\.in' in text
    assert '_validate_uuid' in text
    assert 'Invalid {label}: must be a UUID' in text
    assert '_require_role' in text
    assert '_SCHEDULING_ROLES' in text
    assert '_COMPLIANCE_ROLES' in text
    assert '_READ_ROLES' in text


def test_release2_scheduling_has_audit_and_calendar_boundary_controls():
    text = ROUTER.read_text()
    assert 'async def _audit' in text
    for action in [
        'appointment.created',
        'appointment.updated',
        'availability_rule.created',
        'appointment_attendee.created',
        'reminder.created',
        'calendar_sync_event.created',
    ]:
        assert action in text
    assert 'authoritative' in text
    assert 'False' in text


def test_release2_scheduling_does_not_delete_regulated_records():
    text = ROUTER.read_text().lower()
    assert '@router.delete' not in text
    assert 'method="delete"' not in text
    assert 'client.delete' not in text
