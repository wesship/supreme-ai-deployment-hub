from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_release3_communications.py"
MAIN = ROOT / "backend" / "main.py"


def read_router() -> str:
    return ROUTER.read_text(encoding="utf-8")


def read_main() -> str:
    return MAIN.read_text(encoding="utf-8")


def test_release3_communications_router_exists_and_uses_primetime_namespace():
    source = read_router()
    assert "APIRouter(prefix=\"/primetime/v1\"" in source
    assert "primetime-release3-communications" in source


def test_release3_communications_router_is_mounted_in_main_app():
    source = read_main()
    assert "primetime_release3_communications" in source
    assert "primetime_release3_communications_router" in source
    assert "PRIMETIME Release 3 communications router registered at /primetime/v1" in source


def test_release3_communications_table_allow_list_is_fixed():
    source = read_router()
    assert "_ALLOWED_TABLES = frozenset" in source
    for table in [
        "message_templates",
        "message_template_versions",
        "communication_preferences",
        "communication_frequency_counters",
        "communications",
        "communication_events",
        "communication_policy_checks",
        "audit_events",
    ]:
        assert f'"{table}"' in source
    assert "Unknown table" in source


def test_release3_communications_required_endpoints_exist():
    source = read_router()
    for endpoint in [
        '@router.get("/message-templates")',
        '@router.post("/message-templates")',
        '@router.patch("/message-templates/{template_id}")',
        '@router.get("/message-template-versions")',
        '@router.post("/message-template-versions")',
        '@router.get("/communication-preferences")',
        '@router.post("/communication-preferences")',
        '@router.get("/communications")',
        '@router.post("/communications")',
        '@router.patch("/communications/{communication_id}")',
        '@router.get("/communication-events")',
        '@router.post("/communication-events")',
        '@router.get("/communication-policy-checks")',
        '@router.post("/communication-policy-checks")',
    ]:
        assert endpoint in source


def test_release3_communications_preserves_no_send_and_no_delete_boundary():
    source = read_router()
    assert '@router.delete(' not in source
    assert '"/send"' not in source
    assert "no-autonomous-send" in source or "does not expose delete endpoints or delivery/send endpoints" in source
    assert "_forbid_autonomous_send" in source
    assert "Release 3 records delivery events but does not send communications" in source


def test_release3_communications_validates_host_uuid_and_membership():
    source = read_router()
    assert "_ALLOWED_HOST_RE" in source
    assert "Invalid SUPABASE_URL host" in source
    assert "_validate_uuid" in source
    assert "Workspace access required" in source
    assert "workspace_memberships" in source
    assert "status\": \"eq.active\"" in source


def test_release3_communications_role_gates_template_approvals_and_policy_checks():
    source = read_router()
    assert "_READ_ROLES" in source
    assert "_DRAFT_ROLES" in source
    assert "_APPROVAL_ROLES" in source
    assert "_COMPLIANCE_ROLES" in source
    assert "approved_by" in source
    assert "Insufficient PRIMETIME role" in source
    assert "communication_policy_check.created" in source


def test_release3_communications_writes_audit_events_for_mutations():
    source = read_router()
    for action in [
        "message_template.created",
        "message_template.updated",
        "message_template_version.created",
        "communication_preference.created",
        "communication.created",
        "communication.updated",
        "communication_event.created",
        "communication_policy_check.created",
    ]:
        assert action in source
    assert "audit_events" in source
    assert "prefer=\"return=minimal\"" in source
