from __future__ import annotations
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from backend.agents import governance_control

@pytest.mark.asyncio
async def test_workspace_admin_can_update_policy(monkeypatch):
    async def membership(workspace_id: str, user_id: str): return {"workspace_id": workspace_id, "role": "workspace_admin"}
    captured = {}
    async def mutate(**kwargs): captured.update(kwargs); return {"ok": True}
    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", mutate)
    response = await governance_control.update_workspace_policy(
        governance_control.WorkspacePolicyMutationRequest(workspace_id="w", kill_switch_enabled=True, disabled_agents=["openclaw-bridge"]),
        user_id="u")
    assert response.operation == "workspace_policy_updated"
    assert captured["actor_user_id"] == "u"

@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["representative", "manager", "compliance_reviewer", "platform_admin", "auditor"])
async def test_only_workspace_admin_can_change_policy(monkeypatch, role):
    async def membership(workspace_id: str, user_id: str): return {"workspace_id": workspace_id, "role": role}
    async def forbidden(**kwargs): raise AssertionError("RPC must not run")
    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "set_workspace_policy", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.update_workspace_policy(
            governance_control.WorkspacePolicyMutationRequest(workspace_id="w", kill_switch_enabled=False), user_id="u")
    assert exc.value.status_code == 403

@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["workspace_admin", "manager", "compliance_reviewer"])
async def test_authorized_roles_can_grant_approval(monkeypatch, role):
    async def membership(workspace_id: str, user_id: str): return {"workspace_id": workspace_id, "role": role}
    async def grant(**kwargs): return {"id": "a"}
    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", grant)
    response = await governance_control.create_approval(
        governance_control.ApprovalGrantRequest(workspace_id="w", action="orchestrate",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)), user_id="u")
    assert response.operation == "approval_granted"

@pytest.mark.asyncio
async def test_platform_admin_cannot_grant_workspace_approval(monkeypatch):
    async def membership(workspace_id: str, user_id: str): return {"workspace_id": workspace_id, "role": "platform_admin"}
    async def forbidden(**kwargs): raise AssertionError("RPC must not run")
    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(workspace_id="w", action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1)), user_id="u")
    assert exc.value.status_code == 403

@pytest.mark.asyncio
async def test_approval_lifetime_over_seven_days_is_rejected(monkeypatch):
    async def membership(workspace_id: str, user_id: str): return {"workspace_id": workspace_id, "role": "workspace_admin"}
    async def forbidden(**kwargs): raise AssertionError("RPC must not run")
    monkeypatch.setattr(governance_control, "_membership_required", membership)
    monkeypatch.setattr(governance_control, "grant_approval", forbidden)
    with pytest.raises(HTTPException) as exc:
        await governance_control.create_approval(
            governance_control.ApprovalGrantRequest(workspace_id="w", action="orchestrate",
                expires_at=datetime.now(timezone.utc) + timedelta(days=8)), user_id="u")
    assert exc.value.status_code == 422
