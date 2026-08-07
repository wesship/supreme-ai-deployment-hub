from __future__ import annotations
from datetime import datetime, timezone
import pytest
from backend.agents import control_plane_store

@pytest.mark.asyncio
async def test_policy_mutation_uses_atomic_rpc(monkeypatch):
    calls = []
    async def fake_rpc(name, payload):
        calls.append((name, payload)); return {"workspace_id": payload["p_workspace_id"]}
    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)
    await control_plane_store.set_workspace_policy(workspace_id="w", kill_switch_enabled=True,
        disabled_agents={"b", "a"}, actor_user_id="u", reason="incident")
    assert calls[0][0] == "agent_os_set_workspace_policy"
    assert calls[0][1]["p_disabled_agents"] == ["a", "b"]
    assert calls[0][1]["p_actor_user_id"] == "u"

@pytest.mark.asyncio
async def test_approval_grant_uses_atomic_rpc(monkeypatch):
    calls = []
    async def fake_rpc(name, payload):
        calls.append((name, payload)); return {"id": "approval"}
    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)
    expires = datetime(2026, 8, 8, 12, 0, tzinfo=timezone.utc)
    await control_plane_store.grant_approval(workspace_id="w", action="orchestrate",
        agent_name="devonn-coordinator", actor_user_id="u", expires_at=expires,
        reason="approved", metadata={"ticket": "INC-123"})
    assert calls[0][0] == "agent_os_grant_approval"
    assert calls[0][1]["p_expires_at"] == expires.isoformat()
    assert calls[0][1]["p_metadata"] == {"ticket": "INC-123"}

@pytest.mark.asyncio
async def test_approval_revoke_uses_actor_scoped_atomic_rpc(monkeypatch):
    calls = []
    async def fake_rpc(name, payload):
        calls.append((name, payload)); return {"id": payload["p_approval_id"]}
    monkeypatch.setattr(control_plane_store, "_rpc", fake_rpc)
    await control_plane_store.revoke_approval(workspace_id="w", approval_id="a", actor_user_id="reviewer", reason="withdrawn")
    assert calls[0][0] == "agent_os_revoke_approval"
    assert calls[0][1]["p_actor_user_id"] == "reviewer"
