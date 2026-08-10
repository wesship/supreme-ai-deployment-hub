from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.agents import router as agent_router
from backend.agents.governance_context import ResolvedAgentGovernanceContext
from backend.mesh.agent_mesh import AgentResult


def _context(*, approved_actions=None, disabled_agents=None, kill_switch=False):
    return ResolvedAgentGovernanceContext(
        workspace_id="staging-workspace",
        actor_id="staging-actor",
        role="workspace_admin",
        permissions={"agent.plan", "agent.orchestrate", "agent.read", "agent.review"},
        approved_actions=set(approved_actions or []),
        disabled_agents=set(disabled_agents or []),
        kill_switch_enabled=kill_switch,
    )


def _decision(value: str, reason: str):
    return SimpleNamespace(
        governance=SimpleNamespace(
            decision=SimpleNamespace(value=value),
            reason=reason,
            missing_permissions=[],
        )
    )


@pytest.mark.asyncio
async def test_release_drill_kill_switch_blocks_provider(monkeypatch):
    executed = False

    async def fake_context(**kwargs):
        return _context(kill_switch=True)

    async def fake_audit(**kwargs):
        return None

    async def fake_dispatch(task):
        nonlocal executed
        executed = True
        raise AssertionError("provider must not execute while kill switch is enabled")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "write_dispatch_audit", fake_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(
            agent_router.DispatchRequest(
                workspace_id="staging-workspace",
                agent_name="devonn-coordinator",
                action="plan",
            ),
            user_id="staging-actor",
        )

    assert exc.value.status_code == 403
    assert executed is False


@pytest.mark.asyncio
async def test_release_drill_approval_required_blocks_provider(monkeypatch):
    executed = False

    async def fake_context(**kwargs):
        return _context()

    async def fake_audit(**kwargs):
        return None

    async def fake_dispatch(task):
        nonlocal executed
        executed = True
        raise AssertionError("provider must not execute before approval")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "write_dispatch_audit", fake_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(
            agent_router.DispatchRequest(
                workspace_id="staging-workspace",
                agent_name="devonn-coordinator",
                action="orchestrate",
            ),
            user_id="staging-actor",
        )

    assert exc.value.status_code == 409
    assert executed is False


@pytest.mark.asyncio
async def test_release_drill_audit_outage_fails_closed(monkeypatch):
    executed = False

    async def fake_context(**kwargs):
        return _context()

    async def failing_audit(**kwargs):
        raise RuntimeError("simulated audit outage")

    async def fake_dispatch(task):
        nonlocal executed
        executed = True
        raise AssertionError("provider must not execute without decision evidence")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "evaluate_agent_capability_dry_run", lambda request: _decision("allow", "allowed"))
    monkeypatch.setattr(agent_router, "write_dispatch_audit", failing_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(
            agent_router.DispatchRequest(
                workspace_id="staging-workspace",
                agent_name="devonn-coordinator",
                action="plan",
            ),
            user_id="staging-actor",
        )

    assert exc.value.status_code == 503
    assert executed is False


@pytest.mark.asyncio
async def test_release_drill_allowed_named_dispatch_correlates_audit(monkeypatch):
    sequence = []
    task_ids = []

    async def fake_context(**kwargs):
        return _context()

    async def fake_audit(**kwargs):
        sequence.append(kwargs["event_type"])
        task_ids.append(kwargs["task_id"])

    async def fake_dispatch(task):
        sequence.append("provider")
        return AgentResult(
            task_id=task.task_id,
            agent_name=task.agent_name,
            success=True,
            data={"ok": True},
        )

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "evaluate_agent_capability_dry_run", lambda request: _decision("allow", "allowed"))
    monkeypatch.setattr(agent_router, "write_dispatch_audit", fake_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    result = await agent_router.dispatch_task(
        agent_router.DispatchRequest(
            workspace_id="staging-workspace",
            agent_name="devonn-coordinator",
            action="plan",
        ),
        user_id="staging-actor",
    )

    assert sequence == ["agent_os.dispatch.decision", "provider", "agent_os.dispatch.outcome"]
    assert len(set(task_ids)) == 1
    assert task_ids[0] == result.task_id


@pytest.mark.asyncio
async def test_release_drill_capability_route_uses_named_governance(monkeypatch):
    class HealthyClient:
        reg = SimpleNamespace(name="devonn-coordinator")

        async def health_check(self):
            return True

    seen = []

    monkeypatch.setattr(agent_router.default_mesh, "find_by_capability", lambda capability: [HealthyClient()])

    async def fake_named_dispatch(request, user_id):
        seen.append((request.agent_name, request.action, user_id))
        return AgentResult(
            task_id="task",
            agent_name=request.agent_name,
            success=True,
            data={"ok": True},
        )

    monkeypatch.setattr(agent_router, "dispatch_task", fake_named_dispatch)

    result = await agent_router.dispatch_by_capability(
        agent_router.CapabilityDispatchRequest(
            workspace_id="staging-workspace",
            capability="plan",
        ),
        user_id="staging-actor",
    )

    assert result.success is True
    assert seen == [("devonn-coordinator", "plan", "staging-actor")]
