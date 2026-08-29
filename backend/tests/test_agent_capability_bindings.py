import pytest

from backend.agents.capability_bindings import (
    AgentDryRunRequest,
    create_default_agent_tool_registry,
    evaluate_agent_capability_dry_run,
)
from backend.agents.governance import GovernanceDecision


def test_plan_is_allowed_with_permission():
    result = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="devonn-coordinator",
            capability="plan",
            workspace_permissions={"agent.plan"},
        )
    )
    assert result.governance.decision is GovernanceDecision.ALLOW


def test_orchestrate_requires_approval():
    result = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="devonn-coordinator",
            capability="orchestrate",
            workspace_permissions={"agent.orchestrate"},
        )
    )
    assert result.governance.decision is GovernanceDecision.REQUIRE_APPROVAL


def test_orchestrate_allows_after_explicit_approval():
    result = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="devonn-coordinator",
            capability="orchestrate",
            workspace_permissions={"agent.orchestrate"},
            approved_actions={"orchestrate"},
        )
    )
    assert result.governance.decision is GovernanceDecision.ALLOW


def test_code_generation_is_bound_to_openclaw():
    with pytest.raises(PermissionError):
        evaluate_agent_capability_dry_run(
            AgentDryRunRequest(
                workspace_id="ws-1",
                actor_id="user-1",
                agent_name="devonn-coordinator",
                capability="code_generate",
                workspace_permissions={"code.generate"},
            )
        )


def test_unknown_capability_fails_closed():
    with pytest.raises(KeyError):
        evaluate_agent_capability_dry_run(
            AgentDryRunRequest(
                workspace_id="ws-1",
                actor_id="user-1",
                agent_name="openclaw-bridge",
                capability="deploy_production",
                workspace_permissions={"*"},
            )
        )


def test_kill_switch_overrides_valid_permission():
    result = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="openclaw-bridge",
            capability="code_review",
            workspace_permissions={"code.review"},
            kill_switch_enabled=True,
        )
    )
    assert result.governance.decision is GovernanceDecision.DENY


def test_chip_design_space_capability_requires_explicit_permission():
    denied = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="devonn-coordinator",
            capability="chip.design_space.optimize",
        )
    )
    allowed = evaluate_agent_capability_dry_run(
        AgentDryRunRequest(
            workspace_id="ws-1",
            actor_id="user-1",
            agent_name="devonn-coordinator",
            capability="chip.design_space.optimize",
            workspace_permissions={"optimization.chip_design_space"},
        )
    )
    assert denied.governance.decision is GovernanceDecision.DENY
    assert allowed.governance.decision is GovernanceDecision.ALLOW


def test_registry_contains_only_current_mesh_capabilities():
    names = [tool.name for tool in create_default_agent_tool_registry().list_enabled()]
    assert names == [
        "chip.design_space.optimize",
        "code_generate",
        "code_review",
        "orchestrate",
        "plan",
        "quantum.optimize",
        "review",
        "summarize",
        "test_generate",
    ]
