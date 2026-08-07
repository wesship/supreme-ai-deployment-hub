from __future__ import annotations

import pytest

from backend.agents import policy_store


@pytest.mark.asyncio
async def test_workspace_policy_defaults_when_missing(monkeypatch):
    async def fake_get(path, params):
        assert path == "agent_os_workspace_policies"
        return []

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    assert await policy_store.resolve_workspace_policy("workspace") == (False, set())


@pytest.mark.asyncio
async def test_workspace_policy_returns_kill_switch_and_disabled_agents(monkeypatch):
    async def fake_get(path, params):
        return [{"kill_switch_enabled": True, "disabled_agents": ["openclaw-bridge"]}]

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    enabled, disabled = await policy_store.resolve_workspace_policy("workspace")
    assert enabled is True
    assert disabled == {"openclaw-bridge"}


@pytest.mark.asyncio
async def test_active_approvals_are_agent_scoped(monkeypatch):
    async def fake_get(path, params):
        assert path == "agent_os_approvals"
        return [
            {"action": "orchestrate", "agent_name": None, "revoked_at": None},
            {"action": "code_generate", "agent_name": "openclaw-bridge", "revoked_at": None},
            {"action": "review", "agent_name": "devonn-coordinator", "revoked_at": None},
        ]

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    approved = await policy_store.resolve_active_approvals("workspace", "openclaw-bridge")
    assert approved == {"orchestrate", "code_generate"}
