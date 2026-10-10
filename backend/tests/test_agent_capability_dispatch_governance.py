from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.agents import router as agent_router
from backend.mesh.agent_mesh import AgentResult, TaskPriority


class _HealthyClient:
    def __init__(self, name: str, healthy: bool = True):
        self.reg = SimpleNamespace(name=name)
        self._healthy = healthy

    async def health_check(self) -> bool:
        return self._healthy


@pytest.mark.asyncio
async def test_capability_dispatch_routes_through_governed_named_dispatch(monkeypatch):
    calls = []

    monkeypatch.setattr(
        agent_router.default_mesh,
        "find_by_capability",
        lambda capability: [_HealthyClient("devonn-coordinator")],
    )

    async def fake_dispatch_task(request, user_id):
        calls.append((request, user_id))
        return AgentResult(
            task_id="task",
            agent_name=request.agent_name,
            success=True,
            data={"ok": True},
        )

    monkeypatch.setattr(agent_router, "dispatch_task", fake_dispatch_task)

    result = await agent_router.dispatch_by_capability(
        agent_router.CapabilityDispatchRequest(
            workspace_id="workspace",
            capability="plan",
            payload={"goal": "test"},
            priority=TaskPriority.HIGH,
            timeout_seconds=45,
            max_retries=2,
        ),
        user_id="actor",
    )

    assert result.success is True
    assert len(calls) == 1
    named_request, actor = calls[0]
    assert actor == "actor"
    assert named_request.workspace_id == "workspace"
    assert named_request.agent_name == "devonn-coordinator"
    assert named_request.action == "plan"
    assert named_request.priority == TaskPriority.HIGH
    assert named_request.timeout_seconds == 45
    assert named_request.max_retries == 2


@pytest.mark.asyncio
async def test_capability_dispatch_skips_unhealthy_candidate(monkeypatch):
    monkeypatch.setattr(
        agent_router.default_mesh,
        "find_by_capability",
        lambda capability: [
            _HealthyClient("offline-agent", healthy=False),
            _HealthyClient("devonn-coordinator", healthy=True),
        ],
    )

    seen = []

    async def fake_dispatch_task(request, user_id):
        seen.append(request.agent_name)
        return AgentResult(
            task_id="task",
            agent_name=request.agent_name,
            success=True,
            data={},
        )

    monkeypatch.setattr(agent_router, "dispatch_task", fake_dispatch_task)

    await agent_router.dispatch_by_capability(
        agent_router.CapabilityDispatchRequest(
            workspace_id="workspace",
            capability="plan",
        ),
        user_id="actor",
    )

    assert seen == ["devonn-coordinator"]


@pytest.mark.asyncio
async def test_capability_dispatch_fails_when_no_healthy_candidate(monkeypatch):
    monkeypatch.setattr(
        agent_router.default_mesh,
        "find_by_capability",
        lambda capability: [_HealthyClient("offline-agent", healthy=False)],
    )

    with pytest.raises(HTTPException) as exc:
        await agent_router.dispatch_by_capability(
            agent_router.CapabilityDispatchRequest(
                workspace_id="workspace",
                capability="plan",
            ),
            user_id="actor",
        )

    assert exc.value.status_code == 503


def test_capability_dispatch_request_has_no_separate_action_field():
    request = agent_router.CapabilityDispatchRequest(
        workspace_id="workspace",
        capability="plan",
    )
    assert "action" not in request.model_fields
