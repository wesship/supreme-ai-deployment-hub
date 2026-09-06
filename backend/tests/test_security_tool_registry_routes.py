from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.security.tool_registry_router import router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/security")
    return TestClient(app)


def test_registry_health_is_execution_disabled() -> None:
    response = _client().get("/api/security/tools/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["tool_execution_enabled"] is False
    assert body["active_scan_execution_enabled"] is False
    assert body["exploit_execution_enabled"] is False
    assert body["credential_attack_execution_enabled"] is False


def test_registry_lists_tools_without_execution() -> None:
    response = _client().get("/api/security/tools?risk_tier=green")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] > 0
    assert body["execution_enabled"] is False
    assert all(tool["risk_tier"] == "green" for tool in body["tools"])


def test_policy_endpoint_is_stateless_and_execution_free() -> None:
    response = _client().post(
        "/api/security/tools/policy/evaluate",
        json={
            "tool_id": "nmap",
            "capability": "active_service_discovery",
            "environment": "production",
            "asset_authorized": False,
            "human_approved": False,
            "actor": "hermes",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["decision"]["decision"] == "approval_required"
    assert body["tool_execution_performed"] is False
    assert body["security_event_required_if_executed_later"] is True
    assert body["agent_action_log_required_if_executed_later"] is True


def test_red_tool_is_denied_to_hermes_in_production() -> None:
    response = _client().post(
        "/api/security/tools/policy/evaluate",
        json={
            "tool_id": "metasploit",
            "capability": "exploit_validation",
            "environment": "production",
            "asset_authorized": True,
            "human_approved": True,
            "actor": "hermes",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["decision"]["decision"] == "deny"
    assert body["tool_execution_performed"] is False


def test_graph_and_stix_projections_are_non_persistent() -> None:
    graph = _client().get("/api/security/tools/graph/projection")
    assert graph.status_code == 200
    graph_body = graph.json()
    assert graph_body["persistence_performed"] is False
    assert graph_body["nodes"]
    assert graph_body["edges"]

    stix = _client().get("/api/security/tools/stix/projection")
    assert stix.status_code == 200
    stix_body = stix.json()
    assert stix_body["persistence_performed"] is False
    assert stix_body["objects"]
