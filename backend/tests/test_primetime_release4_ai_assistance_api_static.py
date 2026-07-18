from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_release4_ai_assistance.py"
MAIN = ROOT / "backend" / "main.py"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_release4_router_exists_and_uses_governed_namespace():
    source = read(ROUTER)
    assert 'APIRouter(prefix="/primetime/v1"' in source
    assert 'tags=["primetime-release4-ai-assistance"]' in source


def test_release4_router_is_mounted_in_canonical_app():
    source = read(MAIN)
    assert "primetime_release4_ai_assistance" in source
    assert "PRIMETIME Release 4 AI assistance router registered at /primetime/v1" in source
    assert "app.include_router(primetime_release4_ai_assistance_router)" in source


def test_release4_runtime_endpoint_surface():
    source = read(ROUTER)
    expected = [
        '@router.get("/ai-agents")',
        '@router.post("/ai-agents")',
        '@router.patch("/ai-agents/{agent_id}")',
        '@router.get("/ai-agent-versions")',
        '@router.post("/ai-agent-versions")',
        '@router.patch("/ai-agent-versions/{version_id}")',
        '@router.get("/ai-assistance-requests")',
        '@router.post("/ai-assistance-requests")',
        '@router.patch("/ai-assistance-requests/{request_id}")',
        '@router.get("/ai-assistance-outputs")',
        '@router.post("/ai-assistance-outputs")',
        '@router.patch("/ai-assistance-outputs/{output_id}")',
        '@router.get("/ai-action-ledger")',
        '@router.post("/ai-action-ledger")',
        '@router.get("/ai-approval-requests")',
        '@router.post("/ai-approval-requests")',
        '@router.patch("/ai-approval-requests/{approval_id}")',
        '@router.get("/ai-compliance-findings")',
        '@router.post("/ai-compliance-findings")',
        '@router.patch("/ai-compliance-findings/{finding_id}")',
        '@router.get("/ai-knowledge-citations")',
        '@router.post("/ai-knowledge-citations")',
    ]
    for endpoint in expected:
        assert endpoint in source


def test_release4_uses_fixed_table_allow_list_and_host_validation():
    source = read(ROUTER)
    assert "_ALLOWED_TABLES = frozenset" in source
    for table in [
        "ai_agents",
        "ai_agent_versions",
        "ai_assistance_requests",
        "ai_assistance_outputs",
        "ai_action_ledger",
        "ai_approval_requests",
        "ai_compliance_findings",
        "ai_knowledge_citations",
        "audit_events",
    ]:
        assert f'"{table}"' in source
    assert "_ALLOWED_HOST_RE" in source
    assert "supabase\\.co|supabase\\.in" in source
    assert "Invalid SUPABASE_URL host" in source


def test_release4_requires_workspace_membership_and_role_gates():
    source = read(ROUTER)
    assert "workspace_memberships" in source
    assert "Workspace access required" in source
    assert "_READ_ROLES" in source
    assert "_DRAFT_ROLES" in source
    assert "_APPROVAL_ROLES" in source
    assert "_COMPLIANCE_ROLES" in source
    assert "_ADMIN_ROLES" in source
    assert "_require_role" in source


def test_release4_audit_events_are_written_for_runtime_changes():
    source = read(ROUTER)
    for action in [
        "ai_agent.created",
        "ai_agent.updated",
        "ai_agent_version.created",
        "ai_agent_version.updated",
        "ai_assistance_request.created",
        "ai_assistance_request.updated",
        "ai_assistance_output.created",
        "ai_assistance_output.updated",
        "ai_action.proposed",
        "ai_approval_request.created",
        "ai_approval_request.updated",
        "ai_compliance_finding.created",
        "ai_compliance_finding.updated",
        "ai_knowledge_citation.created",
    ]:
        assert action in source


def test_release4_blocks_regulated_autonomous_actions():
    source = read(ROUTER)
    for blocked in [
        "regulated_recommendation",
        "quote_generation",
        "policy_decision",
        "submit_application",
        "send_message",
        "voice_call",
        "delete_record",
    ]:
        assert blocked in source
    assert "_forbid_regulated_action" in source
    assert "Release 4 blocks autonomous regulated action" in source
    assert "does not execute actions" in source


def test_release4_has_no_send_quote_recommendation_submit_or_delete_endpoints():
    source = read(ROUTER)
    forbidden_routes = [
        '@router.post("/send',
        '@router.post("/quote',
        '@router.post("/recommend-policy',
        '@router.post("/submit-application',
        '@router.delete(',
    ]
    for route in forbidden_routes:
        assert route not in source
