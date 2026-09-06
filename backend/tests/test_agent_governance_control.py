from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from backend.agents import governance_control


@pytest.mark.asyncio
async def test_workspace_admin_can_update_policy(monkeypatch):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    captured = {}

    async def mutate(**kwargs):
        captured.update(kwargs)
        return {"ok": True}

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", mutate)
    response = await governance_control.update_workspace_policy(
        governance_control.WorkspacePolicyMutationRequest(
            workspace_id="w",
            kill_switch_enabled=True,
            disabled_agents=["openclaw-bridge"],
        ),
        user_id="u",
    )
    assert response.operation == "workspace_policy_updated"
    assert captured["actor_user_id"] == "u"


@pytest.mark.asyncio
async def test_workspace_admin_can_start_bounded_canary_lease(monkeypatch):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    captured = {}

    async def mutate(**kwargs):
        captured.update(kwargs)
        return {"canary_unlock_expires_at": "2026-09-06T19:00:00+00:00"}

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "set_canary_unlock_lease", mutate)
    response = await governance_control.start_canary_unlock_lease(
        governance_control.CanaryLeaseRequest(
            workspace_id="w",
            disabled_agents=["openclaw-bridge"],
            lease_seconds=90,
        ),
        user_id="u",
    )
    assert response.operation == "canary_unlock_lease_started"
    assert captured["lease_seconds"] == 90
    assert captured["disabled_agents"] == {"openclaw-bridge"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role",
    ["representative", "manager", "compliance_reviewer", "platform_admin", "auditor"],
)
async def test_only_workspace_admin_can_change_policy(monkeypatch, role):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    async def forbidden(**kwargs):
        raise AssertionError("RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.update_workspace_policy(
            governance_control.WorkspacePolicyMutationRequest(
                workspace_id="w", kill_switch_enabled=False
            ),
            user_id="u",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["workspace_admin", "manager", "compliance_reviewer"])
async def test_authorized_roles_can_grant_approval(monkeypatch, role):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    async def grant(**kwargs):
        return {"id": "a"}

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", grant)
    response = await governance_control.create_approval(
        governance_control.ApprovalGrantRequest(
            workspace_id="w",
            action="orchestrate",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ),
        user_id="u",
    )
    assert response.operation == "approval_granted"


@pytest.mark.asyncio
async def test_platform_admin_cannot_grant_workspace_approval(monkeypatch):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "platform_admin"}

    async def forbidden(**kwargs):
        raise AssertionError("RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(
                workspace_id="w",
                action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            ),
            user_id="u",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_approval_lifetime_over_seven_days_is_rejected(monkeypatch):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    async def forbidden(**kwargs):
        raise AssertionError("RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(
                workspace_id="w",
                action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(days=8),
            ),
            user_id="u",
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_workspace_admin_can_read_run_scoped_canary_status(monkeypatch):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    async def policy(workspace_id: str):
        assert workspace_id == "w"
        return True, {"openclaw-bridge"}

    calls: list[tuple[str, dict[str, str]]] = []

    async def rest_get(path: str, params: dict[str, str]):
        calls.append((path, params))
        if path == "agent_os_workspace_policies":
            return [{"canary_unlock_expires_at": None}]
        if path == "agent_os_approvals":
            return []
        if path == "primetime_audit_events":
            assert params["metadata->>canary_run_id"] == "eq.run-1"
            return [
                {
                    "id": 42,
                    "action": "agent_os.dispatch.decision",
                    "entity_type": "agent_task",
                    "entity_id": None,
                    "metadata": {"decision": "deny", "canary_run_id": "run-1", "task_id": "task-1"},
                    "created_at": "2026-09-06T18:00:00+00:00",
                }
            ]
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "resolve_workspace_policy", policy)
    monkeypatch.setattr(governance_control, "_rest_get", rest_get)

    response = await governance_control.get_canary_status(
        workspace_id="w",
        canary_run_id="run-1",
        user_id="u",
    )

    assert response.role == "workspace_admin"
    assert response.policy.kill_switch_enabled is True
    assert response.policy.disabled_agents == ["openclaw-bridge"]
    assert response.recent_audit[0].metadata["canary_run_id"] == "run-1"
    assert [path for path, _ in calls] == [
        "agent_os_workspace_policies",
        "agent_os_approvals",
        "primetime_audit_events",
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role",
    ["representative", "manager", "compliance_reviewer", "platform_admin", "auditor"],
)
async def test_canary_status_is_workspace_admin_only(monkeypatch, role):
    async def membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    async def forbidden_policy(workspace_id: str):
        raise AssertionError("policy store must not be queried")

    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "resolve_workspace_policy", forbidden_policy)

    with pytest.raises(HTTPException) as exc:
        await governance_control.get_canary_status(
            workspace_id="w",
            canary_run_id=None,
            user_id="u",
        )

    assert exc.value.status_code == 403
