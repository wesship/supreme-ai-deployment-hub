from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.agents import control_plane_store


@pytest.mark.asyncio
async def test_set_workspace_policy_uses_atomic_rpc(monkeypatch):
    calls = []

    async def fake_rpc(function_name, payload):
        calls.append((function_name, payload))
        return {
            "workspace_id": payload["p_workspace_id"],
            "kill_switch_enabled": payload["p_kill_switch_enabled"],
            "disabled_agents": payload["p_disabled_agents"],
        }

    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)

    result = await control_plane_store.set_workspace_policy(
        workspace_id="workspace",
        kill_switch_enabled=True,
        disabled_agents={"openclaw-bridge", "devonn-coordinator"},
        actor_user_id="actor",
        reason="incident response",
    )

    assert calls[0][0] == "agent_os_set_workspace_policy"
    assert calls[0][1]["p_disabled_agents"] == ["devonn-coordinator", "openclaw-bridge"]
    assert calls[0][1]["p_actor_user_id"] == "actor"
    assert result["kill_switch_enabled"] is True


@pytest.mark.asyncio
async def test_grant_approval_uses_expiring_atomic_rpc(monkeypatch):
    calls = []

    async def fake_rpc(function_name, payload):
        calls.append((function_name, payload))
        return {"id": "approval", "action": payload["p_action"]}

    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)
    expires_at = datetime(2026, 8, 8, 12, 0, tzinfo=timezone.utc)

    result = await control_plane_store.grant_approval(
        workspace_id="workspace",
        action="orchestrate",
        agent_name="devonn-coordinator",
        actor_user_id="actor",
        expires_at=expires_at,
        reason="approved maintenance",
        metadata={"ticket": "INC-123"},
    )

    assert calls[0][0] == "agent_os_grant_approval"
    assert calls[0][1]["p_expires_at"] == expires_at.isoformat()
    assert calls[0][1]["p_agent_name"] == "devonn-coordinator"
    assert calls[0][1]["p_metadata"] == {"ticket": "INC-123"}
    assert result["id"] == "approval"


@pytest.mark.asyncio
async def test_revoke_approval_records_actor_through_atomic_rpc(monkeypatch):
    calls = []

    async def fake_rpc(function_name, payload):
        calls.append((function_name, payload))
        return {"id": payload["p_approval_id"], "revoked_at": "2026-08-07T18:00:00Z"}

    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)

    result = await control_plane_store.revoke_approval(
        workspace_id="workspace",
        approval_id="approval",
        actor_user_id="reviewer",
        reason="request withdrawn",
    )

    assert calls[0][0] == "agent_os_revoke_approval"
    assert calls[0][1]["p_actor_user_id"] == "reviewer"
    assert calls[0][1]["p_reason"] == "request withdrawn"
    assert result["id"] == "approval"
