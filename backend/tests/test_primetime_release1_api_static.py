from pathlib import Path

ROUTER = Path("backend/app/routers/primetime_release1.py")


def test_release1_router_exists():
    assert ROUTER.exists(), "Release 1 API router must exist"


def test_router_exposes_required_prefix_and_endpoints():
    text = ROUTER.read_text()
    assert 'prefix="/primetime/v1"' in text
    for route in [
        '/workspaces',
        '/people',
        '/households',
        '/pipeline-stages',
        '/leads',
        '/tasks',
        '/activities',
        '/consent-records',
        '/suppression-records',
        '/exceptions',
        '/dashboard/daily',
    ]:
        assert route in text


def test_router_uses_fixed_table_allowlist_and_workspace_guard():
    text = ROUTER.read_text()
    assert '_ALLOWED_TABLES = frozenset' in text
    assert 'workspace_memberships' in text
    assert '_membership_required' in text
    assert 'Workspace access required' in text


def test_router_validates_supabase_host_and_uuid_values():
    text = ROUTER.read_text()
    assert 'supabase\\.co|supabase\\.in' in text
    assert '_validate_uuid' in text
    assert 'Invalid {label}: must be a UUID' in text


def test_router_does_not_delete_regulated_records():
    text = ROUTER.read_text().lower()
    assert '@router.delete' not in text
    assert 'client.delete' not in text
