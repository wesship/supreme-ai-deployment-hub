from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.agents import router
from backend.mesh.agent_mesh import AgentResult


class _Decision:
    def __init__(self, value: str):
        self.value = value


def _governance(value: str):
    return SimpleNamespace(
        governance=SimpleNamespace(
            decision=_Decision(value),
            reason="canary regression test",
            missing_permissions=[],
        )
    )


@pytest.mark.asyncio
async def test_successful_dispatch_correlates_run_id_in_decision_and_outcome(monkeypatch):
    monkeypatch.setattr(router.default_mesh, "get_agent", lambda name: object())

    async def context(**kwargs):
        return SimpleNamespace(
            workspace_id="w",
            actor_id="u",
            role="workspace_admin",
            permissions={"agent.execute"},
            approved_actions=set(),
            disabled_agents=set(),
            kill_switch_enabled=False,
        )

    monkeypatch.setattr(router, "resolve_agent_governance_context", context)
    monkeypatch.setattr(router, "evaluate_agent_capability_dry_run", lambda request: _governance("allow"))

    audit_events: list[dict] = []

    async def audit(**kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(router, "write_dispatch_audit", audit)

    async def dispatch(task):
        return AgentResult(
            task_id=task.task_id,
            agent_name=task.agent_name,
            success=True,
            data={"ok": True},
            duration_ms=1.0,
            retries_used=0,
        )

    monkeypatch.setattr(router.default_mesh, "dispatch", dispatch)

    result = await router.dispatch_task(
        router.DispatchRequest(
            workspace_id="w",
            agent_name="devonn-coordinator",
            action="plan",
            payload={"canary_run_id": "  run-abc  ", "canary": True},
            priority="low",
            max_retries=0,
        ),
        user_id="u",
    )

    assert len(audit_events) == 2
    assert [event["event_type"] for event in audit_events] == [
        "agent_os.dispatch.decision",
        "agent_os.dispatch.outcome",
    ]
    assert all(event["event_data"]["canary_run_id"] == "run-abc" for event in audit_events)
    assert all(event["task_id"] == result.task_id for event in audit_events)


@pytest.mark.asyncio
async def test_denied_dispatch_still_records_run_scoped_decision(monkeypatch):
    monkeypatch.setattr(router.default_mesh, "get_agent", lambda name: object())

    async def context(**kwargs):
        return SimpleNamespace(
            workspace_id="w",
            actor_id="u",
            role="workspace_admin",
            permissions={"agent.execute"},
            approved_actions=set(),
            disabled_agents=set(),
            kill_switch_enabled=True,
        )

    monkeypatch.setattr(router, "resolve_agent_governance_context", context)
    monkeypatch.setattr(router, "evaluate_agent_capability_dry_run", lambda request: _governance("deny"))

    audit_events: list[dict] = []

    async def audit(**kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(router, "write_dispatch_audit", audit)

    async def must_not_dispatch(task):
        raise AssertionError("provider dispatch must not occur for denied canary")

    monkeypatch.setattr(router.default_mesh, "dispatch", must_not_dispatch)

    with pytest.raises(HTTPException) as exc:
        await router.dispatch_task(
            router.DispatchRequest(
                workspace_id="w",
                agent_name="devonn-coordinator",
                action="plan",
                payload={"canary_run_id": "run-denied", "canary": True},
                priority="low",
                max_retries=0,
            ),
            user_id="u",
        )

    assert exc.value.status_code == 403
    assert len(audit_events) == 1
    assert audit_events[0]["event_type"] == "agent_os.dispatch.decision"
    assert audit_events[0]["event_data"]["canary_run_id"] == "run-denied"
