from datetime import datetime, timedelta, timezone

import pytest

from backend.agents import governance_control as control


@pytest.mark.asyncio
async def test_workspace_admin_can_update_policy(monkeypatch):
    async def membership(workspace_id, user_id):
        return {"workspace_id": workspace_id, "role": "workspace_admin"}

    captured = {}

    async def upsert(**kwargs):
        captured.update(kwargs)
        return kwargs

    async def resolve(_workspace_id):
        return False, set()

    async def audit(*args, **kwargs):
        captured["audited"] = True

    monkeypatch.setattr(control, "_membership_required", membership)
    monkeypatch.setattr(control, "resolve_workspace_policy", resolve)
    monkeypatch.setattr(control, "upsert_workspace_policy", upsert)
    monkeypatch.setattr(control, "_audit", audit)

    result = await control.update_workspace_policy(
        control.WorkspacePolicyUpdate(
            workspace_id="00000000-0000-0000-0000-000000000001",
            kill_switch_enabled=True,
            disabled_agents={"openclaw-bridge"},
        ),
        user_id="00000000-0000-0000-0000-000000000002",
    )
    assert result["kill_switch_enabled"] is True
    assert captured["audited"] is True


@pytest.mark.asyncio
async def test_non_admin_cannot_update_policy(monkeypatch):
    async def membership(workspace_id, user_id):
        return {"workspace_id": workspace_id, "role": "representative"}

    monkeypatch.setattr(control, "_membership_required", membership)
    with pytest.raises(Exception):
        await control.update_workspace_policy(
            control.WorkspacePolicyUpdate(
                workspace_id="00000000-0000-0000-0000-000000000001",
                kill_switch_enabled=True,
            ),
            user_id="00000000-0000-0000-0000-000000000002",
        )


@pytest.mark.asyncio
async def test_compliance_can_grant_expiring_approval(monkeypatch):
    async def membership(workspace_id, user_id):
        return {"workspace_id": workspace_id, "role": "compliance_reviewer"}

    async def create(**kwargs):
        return {"id": "00000000-0000-0000-0000-000000000003", **kwargs}

    audited = {"value": False}

    async def audit(*args, **kwargs):
        audited["value"] = True

    monkeypatch.setattr(control, "_membership_required", membership)
    monkeypatch.setattr(control, "create_approval", create)
    monkeypatch.setattr(control, "_audit", audit)

    result = await control.grant_approval(
        control.ApprovalCreate(
            workspace_id="00000000-0000-0000-0000-000000000001",
            action="orchestrate",
            agent_name="devonn-coordinator",
            expires_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            reason="approved test",
        ),
        user_id="00000000-0000-0000-0000-000000000002",
    )
    assert result["action"] == "orchestrate"
    assert result["executed"] is False
    assert audited["value"] is True


def test_approval_expiry_must_be_future():
    with pytest.raises(Exception):
        control._validate_expiry(
            (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        )
