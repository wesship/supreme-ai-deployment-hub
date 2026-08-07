import asyncio

import pytest
from fastapi import HTTPException

from backend.agents.governance_context import ResolvedAgentGovernanceContext
from backend.agents.router import DispatchRequest, dispatch_task
from backend.mesh.agent_mesh import AgentResult


WORKSPACE_ID = "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
USER_ID = "01efde25-7c02-4bda-bcec-1c07f18b95e7"


def _context(*, permissions: set[str], approvals: set[str] | None = None, kill_switch: bool = False):
    return ResolvedAgentGovernanceContext(
        workspace_id=WORKSPACE_ID,
        actor_id=USER_ID,
        role="workspace_admin",
        permissions=permissions,
        approved_actions=approvals or set(),
        disabled_agents=set(),
        kill_switch_enabled=kill_switch,
    )


def _request(action: str = "plan") -> DispatchRequest:
    return DispatchRequest(
        workspace_id=WORKSPACE_ID,
        agent_name="devonn-coordinator",
        action=action,
        payload={"goal": "test"},
    )


def _install_registered_agent(monkeypatch):
    monkeypatch.setattr("backend.agents.router.default_mesh.get_agent", lambda name: object())


def test_denied_dispatch_never_reaches_mesh(monkeypatch):
    _install_registered_agent(monkeypatch)
    calls = {"dispatch": 0, "audit": 0}

    async def fake_resolve(**kwargs):
        return _context(permissions=set())

    async def fake_audit(*args, **kwargs):
        calls["audit"] += 1

    async def fake_dispatch(task):
        calls["dispatch"] += 1
        raise AssertionError("mesh dispatch must not run for denied decisions")

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dispatch_task(_request("plan"), user_id=USER_ID))

    assert exc.value.status_code == 403
    assert calls == {"dispatch": 0, "audit": 1}


def test_approval_required_never_reaches_mesh(monkeypatch):
    _install_registered_agent(monkeypatch)
    calls = {"dispatch": 0}

    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.orchestrate"})

    async def fake_audit(*args, **kwargs):
        return None

    async def fake_dispatch(task):
        calls["dispatch"] += 1
        raise AssertionError("mesh dispatch must not run before approval")

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dispatch_task(_request("orchestrate"), user_id=USER_ID))

    assert exc.value.status_code == 409
    assert calls["dispatch"] == 0


def test_audit_failure_blocks_execution(monkeypatch):
    _install_registered_agent(monkeypatch)
    calls = {"dispatch": 0}

    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.plan"})

    async def fake_audit(*args, **kwargs):
        raise RuntimeError("audit unavailable")

    async def fake_dispatch(task):
        calls["dispatch"] += 1
        raise AssertionError("mesh dispatch must not run if audit evidence cannot be written")

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    with pytest.raises(RuntimeError, match="audit unavailable"):
        asyncio.run(dispatch_task(_request("plan"), user_id=USER_ID))

    assert calls["dispatch"] == 0


def test_explicit_allow_reaches_mesh_after_audit(monkeypatch):
    _install_registered_agent(monkeypatch)
    order: list[str] = []

    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.plan"})

    async def fake_audit(*args, **kwargs):
        order.append("audit")

    async def fake_dispatch(task):
        order.append("dispatch")
        return AgentResult(
            task_id=task.task_id,
            agent_name=task.agent_name,
            success=True,
            data={"ok": True},
        )

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    result = asyncio.run(dispatch_task(_request("plan"), user_id=USER_ID))

    assert result.success is True
    assert result.data == {"ok": True}
    assert order == ["audit", "dispatch"]


def test_kill_switch_blocks_named_dispatch(monkeypatch):
    _install_registered_agent(monkeypatch)

    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.plan"}, kill_switch=True)

    async def fake_audit(*args, **kwargs):
        return None

    async def fake_dispatch(task):
        raise AssertionError("kill switch must block dispatch")

    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dispatch_task(_request("plan"), user_id=USER_ID))

    assert exc.value.status_code == 403
