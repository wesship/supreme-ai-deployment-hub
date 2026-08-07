import asyncio

import pytest
from fastapi import HTTPException

from backend.agents.governance_context import ResolvedAgentGovernanceContext
from backend.agents.router import CapabilityDispatchRequest, dispatch_by_capability
from backend.mesh.agent_mesh import AgentResult


WORKSPACE_ID = "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
USER_ID = "01efde25-7c02-4bda-bcec-1c07f18b95e7"


class FakeRegistration:
    name = "devonn-coordinator"


class FakeClient:
    reg = FakeRegistration()

    async def health_check(self):
        return True


def _context(*, permissions: set[str], approvals: set[str] | None = None):
    return ResolvedAgentGovernanceContext(
        workspace_id=WORKSPACE_ID,
        actor_id=USER_ID,
        role="workspace_admin",
        permissions=permissions,
        approved_actions=approvals or set(),
        disabled_agents=set(),
        kill_switch_enabled=False,
    )


def test_capability_dispatch_uses_same_governance_path(monkeypatch):
    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.plan"})

    async def fake_audit(*args, **kwargs):
        return None

    async def fake_dispatch(task):
        return AgentResult(
            task_id=task.task_id,
            agent_name=task.agent_name,
            success=True,
            data={"governed": True},
        )

    monkeypatch.setattr("backend.agents.router.default_mesh.find_by_capability", lambda cap: [FakeClient()])
    monkeypatch.setattr("backend.agents.router.default_mesh.get_agent", lambda name: object())
    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    result = asyncio.run(
        dispatch_by_capability(
            CapabilityDispatchRequest(
                workspace_id=WORKSPACE_ID,
                capability="plan",
                payload={"goal": "test"},
            ),
            user_id=USER_ID,
        )
    )

    assert result.success is True
    assert result.data == {"governed": True}


def test_capability_dispatch_requires_approval_before_execution(monkeypatch):
    calls = {"dispatch": 0}

    async def fake_resolve(**kwargs):
        return _context(permissions={"agent.orchestrate"})

    async def fake_audit(*args, **kwargs):
        return None

    async def fake_dispatch(task):
        calls["dispatch"] += 1
        raise AssertionError("approval-required capability must not execute")

    monkeypatch.setattr("backend.agents.router.default_mesh.find_by_capability", lambda cap: [FakeClient()])
    monkeypatch.setattr("backend.agents.router.default_mesh.get_agent", lambda name: object())
    monkeypatch.setattr("backend.agents.router.resolve_agent_governance_context", fake_resolve)
    monkeypatch.setattr("backend.agents.router._audit", fake_audit)
    monkeypatch.setattr("backend.agents.router.default_mesh.dispatch", fake_dispatch)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            dispatch_by_capability(
                CapabilityDispatchRequest(
                    workspace_id=WORKSPACE_ID,
                    capability="orchestrate",
                ),
                user_id=USER_ID,
            )
        )

    assert exc.value.status_code == 409
    assert calls["dispatch"] == 0


def test_unregistered_capability_fails_without_execution(monkeypatch):
    monkeypatch.setattr("backend.agents.router.default_mesh.find_by_capability", lambda cap: [])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            dispatch_by_capability(
                CapabilityDispatchRequest(
                    workspace_id=WORKSPACE_ID,
                    capability="deploy_production",
                ),
                user_id=USER_ID,
            )
        )

    assert exc.value.status_code == 404
