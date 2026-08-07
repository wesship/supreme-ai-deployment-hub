from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from backend.agents import governance_control


@pytest.mark.asyncio
async def test_workspace_admin_can_update_policy(monkeypatch):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    captured = {}

    async def fake_set_workspace_policy(**kwargs):
        captured.update(kwargs)
        return {"ok": True}

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", fake_set_workspace_policy)

    response = await governance_control.update_workspace_policy(
        governance_control.WorkspacePolicyMutationRequest(
            workspace_id="workspace-1",
            kill_switch_enabled=True,
            disabled_agents=["openclaw-bridge", "openclaw-bridge"],
            reason="incident containment",
        ),
        user_id="user-1",
    )

    assert response.operation == "workspace_policy_updated"
    assert captured["workspace_id"] == "workspace-1"
    assert captured["actor_user_id"] == "user-1"
    assert captured["disabled_agents"] == {"openclaw-bridge"}


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["representative", "manager", "compliance_reviewer", "platform_admin", "auditor"])
async def test_only_workspace_admin_can_mutate_policy(monkeypatch, role: str):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    async def should_not_run(**kwargs):
        raise AssertionError("policy RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", should_not_run)

    with pytest.raises(HTTPException) as exc:
        await governance_control.update_workspace_policy(
            governance_control.WorkspacePolicyMutationRequest(
                workspace_id="workspace-1",
                kill_switch_enabled=False,
            ),
            user_id="user-1",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["workspace_admin", "manager", "compliance_reviewer"])
async def test_approval_roles_can_grant(monkeypatch, role: str):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    captured = {}

    async def fake_grant(**kwargs):
        captured.update(kwargs)
        return {"approval_id": "approval-1"}

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "grant_approval", fake_grant)

    response = await governance_control.create_approval(
        governance_control.ApprovalGrantRequest(
            workspace_id="workspace-1",
            action="orchestrate",
            agent_name="devonn-coordinator",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
            reason="supervised run",
        ),
        user_id="user-1",
    )

    assert response.operation == "approval_granted"
    assert captured["action"] == "orchestrate"
    assert captured["agent_name"] == "devonn-coordinator"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["representative", "trainer", "platform_admin", "auditor"])
async def test_non_approval_roles_cannot_grant(monkeypatch, role: str):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": role}

    async def should_not_run(**kwargs):
        raise AssertionError("approval RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "grant_approval", should_not_run)

    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(
                workspace_id="workspace-1",
                action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            ),
            user_id="user-1",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_approval_lifetime_is_bounded(monkeypatch):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    async def should_not_run(**kwargs):
        raise AssertionError("approval RPC must not run")

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "grant_approval", should_not_run)

    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(
                workspace_id="workspace-1",
                action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(days=8),
            ),
            user_id="user-1",
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_compliance_reviewer_can_revoke(monkeypatch):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "compliance_reviewer"}

    captured = {}

    async def fake_revoke(**kwargs):
        captured.update(kwargs)
        return {"approval_id": "approval-1", "revoked": True}

    monkeypatch.setattr(governance_control, "_membership_required", fake_membership)
    monkeypatch.setattr(governance_control, "revoke_approval", fake_revoke)

    response = await governance_control.revoke_existing_approval(
        governance_control.ApprovalRevokeRequest(
            workspace_id="workspace-1",
            approval_id="approval-1",
            reason="approval no longer required",
        ),
        user_id="user-1",
    )

    assert response.operation == "approval_revoked"
    assert captured["approval_id"] == "approval-1"
    assert captured["actor_user_id"] == "user-1"


def test_blank_disabled_agent_name_is_rejected():
    with pytest.raises(ValueError):
        governance_control.WorkspacePolicyMutationRequest(
            workspace_id="workspace-1",
            kill_switch_enabled=True,
            disabled_agents=["   "],
        )


def test_whitespace_agent_scope_is_rejected():
    with pytest.raises(ValueError):
        governance_control.ApprovalGrantRequest(
            workspace_id="workspace-1",
            action="orchestrate",
            agent_name="   ",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
