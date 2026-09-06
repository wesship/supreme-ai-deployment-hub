from __future__ import annotations

from backend.app.security.tool_registry import (
    ActivityClass,
    RiskTier,
    ToolStatus,
    TOOLS,
    evaluate_policy,
    get_tool,
    graph_projection,
    stix_projection,
)


def test_tool_ids_are_unique() -> None:
    ids = [tool.tool_id for tool in TOOLS]
    assert len(ids) == len(set(ids))


def test_red_tools_are_sandbox_only_and_agent_inaccessible() -> None:
    red_tools = [tool for tool in TOOLS if tool.risk_tier == RiskTier.red]
    assert red_tools
    for tool in red_tools:
        assert tool.status == ToolStatus.sandbox_only
        assert tool.agent_access.security_agent is False
        assert tool.agent_access.hermes is False
        assert tool.agent_access.general_agents is False
        assert all(cap.activity_class == ActivityClass.restricted for cap in tool.capabilities)
        assert all(cap.production_allowed is False for cap in tool.capabilities)


def test_passive_defensive_tool_is_allowed_for_hermes_metadata_workflow() -> None:
    decision = evaluate_policy(
        tool_id="virustotal",
        capability="hash_enrichment",
        environment="production",
        actor="hermes",
    )
    assert decision.decision == "allow"
    assert decision.activity_class == ActivityClass.passive
    assert decision.production_execution is False


def test_general_agent_cannot_use_security_tool_by_default() -> None:
    decision = evaluate_policy(
        tool_id="shodan",
        capability="ip_enrichment",
        environment="production",
        actor="general_agent",
    )
    assert decision.decision == "deny"
    assert decision.reason == "agent_not_authorized"


def test_active_scan_requires_asset_authorization_and_human_approval() -> None:
    blocked = evaluate_policy(
        tool_id="nmap",
        capability="active_service_discovery",
        environment="production",
        actor="human",
    )
    assert blocked.decision == "approval_required"

    authorized = evaluate_policy(
        tool_id="nmap",
        capability="active_service_discovery",
        environment="production",
        asset_authorized=True,
        human_approved=True,
        actor="human",
    )
    assert authorized.decision == "allow"
    # This flag means the capability cleared registry policy for a future
    # execution gate. The registry/router themselves never execute a scan.
    assert authorized.production_execution is True


def test_restricted_exploitation_is_denied_in_production() -> None:
    decision = evaluate_policy(
        tool_id="metasploit",
        capability="exploit_validation",
        environment="production",
        asset_authorized=True,
        human_approved=True,
        actor="human",
    )
    assert decision.decision == "deny"
    assert decision.reason == "restricted_capability_sandbox_only"
    assert decision.production_execution is False


def test_restricted_exploitation_requires_approval_even_in_lab() -> None:
    decision = evaluate_policy(
        tool_id="metasploit",
        capability="exploit_validation",
        environment="lab",
        actor="human",
    )
    assert decision.decision == "approval_required"


def test_unknown_tool_or_capability_fails_closed() -> None:
    assert evaluate_policy(tool_id="unknown", capability="x").decision == "deny"
    assert evaluate_policy(tool_id="wazuh", capability="unknown").decision == "deny"


def test_graph_projection_contains_tools_and_capabilities_only() -> None:
    projection = graph_projection()
    node_types = {node["node_type"] for node in projection["nodes"]}
    relationships = {edge["relationship"] for edge in projection["edges"]}

    assert "security_tool" in node_types
    assert "security_capability" in node_types
    assert relationships == {"provides_capability"}
    assert all("command" not in node.get("properties", {}) for node in projection["nodes"])


def test_stix_projection_is_metadata_only() -> None:
    objects = stix_projection()
    assert len(objects) == len(TOOLS)
    assert all(obj["type"] == "x-d3vonn-security-tool" for obj in objects)
    assert all("command" not in obj for obj in objects)
    assert all("credentials" not in obj for obj in objects)


def test_expected_baseline_tools_are_registered() -> None:
    for tool_id in (
        "wazuh",
        "stixview",
        "sigma",
        "yara",
        "suricata",
        "virustotal",
        "shodan",
        "censys",
        "codeql",
        "gitleaks",
        "trivy",
        "nmap",
        "owasp_zap",
        "metasploit",
    ):
        assert get_tool(tool_id) is not None
