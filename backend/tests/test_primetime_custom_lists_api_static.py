from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_custom_lists.py"
MOUNT = ROOT / "backend" / "app" / "routers" / "primetime_custom_lists_mount.py"
REGISTRY = ROOT / "backend" / "app" / "routers" / "__init__.py"


def test_custom_lists_router_has_required_endpoints():
    source = ROUTER.read_text()
    required = [
        '@router.get("/custom-lists")',
        '@router.post("/custom-lists")',
        '@router.patch("/custom-lists/{list_id}")',
        '@router.post("/custom-lists/{list_id}/archive")',
        '@router.get("/custom-lists/{list_id}/members")',
        '@router.post("/custom-lists/{list_id}/members")',
        '@router.post("/custom-lists/{list_id}/members/{person_id}/remove")',
    ]
    for endpoint in required:
        assert endpoint in source
    assert '@router.delete(' not in source


def test_custom_lists_router_enforces_governance_controls():
    source = ROUTER.read_text()
    assert "_membership_required" in source
    assert "_require_role(context, _WRITE_ROLES)" in source
    assert "_require_role(context, _ARCHIVE_ROLES)" in source
    assert '"representative", "manager", "workspace_admin"' in source
    assert '"manager", "workspace_admin"' in source
    assert '"removed_at": "is.null"' in source
    assert '"archived_at": "is.null"' in source
    assert "record_count" in source
    assert "_active_list_required" in source
    assert "Archived custom lists cannot change membership" in source


def test_custom_lists_router_emits_append_only_audit_actions():
    source = ROUTER.read_text()
    for action in [
        "crm.custom_list.created",
        "crm.custom_list.updated",
        "crm.custom_list.archived",
        "crm.custom_list.member_added",
        "crm.custom_list.member_removed",
    ]:
        assert action in source


def test_custom_lists_router_is_mounted_into_release1_registry():
    mount = MOUNT.read_text()
    registry = REGISTRY.read_text()
    assert "release1_router.include_router(custom_lists_router)" in mount
    assert "primetime_custom_lists_mount" in registry
