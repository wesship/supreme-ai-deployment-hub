from backend.agents.governance import (
    AgentActionRequest,
    AgentGovernanceContext,
    GovernanceDecision,
    RiskLevel,
    evaluate_agent_action,
)


def _request(**overrides):
    data = {
        "workspace_id": "workspace-1",
        "actor_id": "user-1",
        "agent_name": "research-agent",
        "action": "research.read",
        "required_permissions": ["research.read"],
        "risk_level": RiskLevel.LOW,
    }
    data.update(overrides)
    return AgentActionRequest(**data)


def test_allows_low_risk_action_with_permission():
    result = evaluate_agent_action(
        _request(),
        AgentGovernanceContext(workspace_permissions={"research.read"}),
    )
    assert result.decision is GovernanceDecision.ALLOW


def test_denies_when_permission_is_missing():
    result = evaluate_agent_action(_request(), AgentGovernanceContext())
    assert result.decision is GovernanceDecision.DENY
    assert result.missing_permissions == ["research.read"]


def test_external_side_effect_requires_approval():
    result = evaluate_agent_action(
        _request(action="email.send", required_permissions=["email.send"], external_side_effect=True),
        AgentGovernanceContext(workspace_permissions={"email.send"}),
    )
    assert result.decision is GovernanceDecision.REQUIRE_APPROVAL


def test_preapproved_external_action_can_proceed():
    result = evaluate_agent_action(
        _request(action="email.send", required_permissions=["email.send"], external_side_effect=True),
        AgentGovernanceContext(
            workspace_permissions={"email.send"},
            approved_actions={"email.send"},
        ),
    )
    assert result.decision is GovernanceDecision.ALLOW


def test_critical_action_is_denied_even_if_preapproved():
    result = evaluate_agent_action(
        _request(action="payments.release", required_permissions=["payments.release"], risk_level=RiskLevel.CRITICAL),
        AgentGovernanceContext(
            workspace_permissions={"payments.release"},
            approved_actions={"payments.release"},
        ),
    )
    assert result.decision is GovernanceDecision.DENY


def test_kill_switch_overrides_everything():
    result = evaluate_agent_action(
        _request(),
        AgentGovernanceContext(
            workspace_permissions={"research.read"},
            kill_switch_enabled=True,
        ),
    )
    assert result.decision is GovernanceDecision.DENY
