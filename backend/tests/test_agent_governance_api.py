import asyncio

from backend.agents.router import GovernanceDryRunApiRequest, governance_dry_run
from backend.agents.governance_context import ResolvedAgentGovernanceContext


async def _run_with_context(monkeypatch, *, role: str, permissions: set[str], capability: str, agent_name: str):
    async def fake_resolve(*, workspace_id: str, user_id: str):
        return ResolvedAgentGovernanceContext(
            workspace_id=workspace_id,
            actor_id=user_id,
            role=role,
            permissions=permissions,
            approved_actions=set(),
            disabled_agents=set(),
            kill_switch_enabled=False,
        )

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    return await governance_dry_run(
        GovernanceDryRunApiRequest(
            workspace_id="b7c0ccda-88d3-48cf-ab91-811fd73a3d79",
            agent_name=agent_name,
            capability=capability,
        ),
        user_id="01efde25-7c02-4bda-bcec-1c07f18b95e7",
    )


def test_representative_can_dry_run_plan_without_execution(monkeypatch):
    result = asyncio.run(
        _run_with_context(
            monkeypatch,
            role="representative",
            permissions={"agent.plan", "agent.read", "agent.review"},
            capability="plan",
            agent_name="devonn-coordinator",
        )
    )

    assert result.decision == "allow"
    assert result.executed is False
    assert result.role == "representative"


def test_orchestrate_requires_approval(monkeypatch):
    result = asyncio.run(
        _run_with_context(
            monkeypatch,
            role="manager",
            permissions={"agent.orchestrate"},
            capability="orchestrate",
            agent_name="devonn-coordinator",
        )
    )

    assert result.decision == "require_approval"
    assert result.executed is False


def test_missing_server_permission_is_denied(monkeypatch):
    result = asyncio.run(
        _run_with_context(
            monkeypatch,
            role="representative",
            permissions={"agent.read"},
            capability="code_generate",
            agent_name="openclaw-bridge",
        )
    )

    assert result.decision == "deny"
    assert result.missing_permissions == ["code.generate"]
    assert result.executed is False


def test_unknown_capability_fails_closed(monkeypatch):
    result = asyncio.run(
        _run_with_context(
            monkeypatch,
            role="workspace_admin",
            permissions={"agent.plan", "agent.orchestrate", "code.generate"},
            capability="deploy_production",
            agent_name="devonn-coordinator",
        )
    )

    assert result.decision == "deny"
    assert "unknown tool" in result.reason
    assert result.executed is False
