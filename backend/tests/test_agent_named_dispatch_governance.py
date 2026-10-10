from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.agents import router as agent_router
from backend.agents.governance_context import ResolvedAgentGovernanceContext
from backend.mesh.agent_mesh import AgentResult


def _context() -> ResolvedAgentGovernanceContext:
    return ResolvedAgentGovernanceContext(
        workspace_id="workspace",
        actor_id="actor",
        role="workspace_admin",
        permissions={"agent.plan", "agent.orchestrate", "agent.read", "agent.review"},
        approved_actions=set(),
        disabled_agents=set(),
        kill_switch_enabled=False,
    )


def _decision(value: str, reason: str = "policy", missing_permissions: list[str] | None = None):
    return SimpleNamespace(
        governance=SimpleNamespace(
            decision=SimpleNamespace(value=value),
            reason=reason,
            missing_permissions=missing_permissions or [],
        )
    )


def _request(action: str = "plan") -> agent_router.DispatchRequest:
    return agent_router.DispatchRequest(
        workspace_id="workspace",
        agent_name="devonn-coordinator",
        action=action,
        payload={"goal": "test"},
    )


@pytest.mark.asyncio
async def test_named_dispatch_deny_never_reaches_mesh(monkeypatch):
    dispatched = False
    audits: list[str] = []

    async def fake_context(**kwargs):
        return _context()

    async def fake_audit(**kwargs):
        audits.append(kwargs["event_type"])

    async def fake_dispatch(task):
        nonlocal dispatched
        dispatched = True
        raise AssertionError("mesh must not execute denied work")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "evaluate_agent_capability_dry_run", lambda request: _decision("deny", "blocked"))
    monkeypatch.setattr(agent_router, "write_dispatch_audit", fake_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(_request(), user_id="actor")

    assert exc.value.status_code == 403
    assert dispatched is False
    assert audits == ["agent_os.dispatch.decision"]


@pytest.mark.asyncio
async def test_named_dispatch_approval_required_never_reaches_mesh(monkeypatch):
    dispatched = False

    async def fake_context(**kwargs):
        return _context()

    async def fake_audit(**kwargs):
        return None

    async def fake_dispatch(task):
        nonlocal dispatched
        dispatched = True
        raise AssertionError("mesh must not execute approval-gated work")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "evaluate_agent_capability_dry_run", lambda request: _decision("require_approval", "approval required"))
    monkeypatch.setattr(agent_router, "write_dispatch_audit", fake_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(_request("orchestrate"), user_id="actor")

    assert exc.value.status_code == 409
    assert dispatched is False


@pytest.mark.asyncio
async def test_named_dispatch_audit_failure_blocks_allow(monkeypatch):
    dispatched = False

    async def fake_context(**kwargs):
        return _context()

    async def failing_audit(**kwargs):
        raise RuntimeError("audit unavailable")

    async def fake_dispatch(task):
        nonlocal dispatched
        dispatched = True
        raise AssertionError("mesh must not execute without decision evidence")

    monkeypatch.setattr(agent_router, "resolve_agent_governance_context", fake_context)
    monkeypatch.setattr(agent_router, "evaluate_agent_capability_dry_run", lambda request: _decision("allow", "allowed"))
    monkeypatch.setattr(agent_router, "write_dispatch_audit", failing_audit)
    monkeypatch.setattr(agent_router.default_mesh, "get_agent", lambda name: object())
    monkeypatch.setattr(agent_router.default_mesh, "dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_task(_request(), user_id="actor")

    assert exc.value.status_code == 503
    assert dispatched is False


@pytest.mark.asyncio
async def test_named_dispatch_allow_audits_before_and_after_execution(monkeypatch):
    sequence: list[str] = []
    task_ids: list[str] = []

    async def fake_context(**kwargs):
        return _context()

    async def fake_audit(**kwargs):
        sequence.append(kwargs["event_type"])
        task_ids.append(kwargs["task_id"])

    async def fake_dispatch(task):
        sequence.append("mesh.dispatch")
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

    result = await agent_router.dispatch_task(_request(), user_id="actor")

    assert result.success is True
    assert sequence == [
        "agent_os.dispatch.decision",
        "mesh.dispatch",
        "agent_os.dispatch.outcome",
    ]
    assert len(set(task_ids)) == 1
    assert task_ids[0] == result.task_id
