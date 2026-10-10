from __future__ import annotations

from datetime import datetime, timedelta, timezone

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
async def test_expired_canary_unlock_lease_fails_closed(monkeypatch):
    expired = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()

    async def fake_get(path, params):
        return [{
            "kill_switch_enabled": False,
            "disabled_agents": ["openclaw-bridge"],
            "canary_unlock_expires_at": expired,
        }]

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    enabled, disabled = await policy_store.resolve_workspace_policy("workspace")
    assert enabled is True
    assert disabled == {"openclaw-bridge"}


@pytest.mark.asyncio
async def test_active_canary_unlock_lease_remains_effectively_unlocked(monkeypatch):
    future = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()

    async def fake_get(path, params):
        return [{
            "kill_switch_enabled": False,
            "disabled_agents": ["openclaw-bridge"],
            "canary_unlock_expires_at": future,
        }]

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    enabled, disabled = await policy_store.resolve_workspace_policy("workspace")
    assert enabled is False
    assert disabled == {"openclaw-bridge"}


@pytest.mark.asyncio
async def test_active_approvals_filter_scope_before_pagination(monkeypatch):
    calls = []

    async def fake_get(path, params):
        assert path == "agent_os_approvals"
        calls.append(dict(params))
        if params["agent_name"] == "is.null":
            return [{"action": "orchestrate"}]
        if params["agent_name"] == "eq.openclaw-bridge":
            return [{"action": "code_generate"}]
        raise AssertionError("unexpected approval scope")

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    approved = await policy_store.resolve_active_approvals("workspace", "openclaw-bridge")

    assert approved == {"orchestrate", "code_generate"}
    assert [call["agent_name"] for call in calls] == ["is.null", "eq.openclaw-bridge"]
    assert all(call["limit"] == str(policy_store._PAGE_SIZE) for call in calls)


@pytest.mark.asyncio
async def test_active_approvals_paginate_until_scope_exhausted(monkeypatch):
    calls = []

    async def fake_get(path, params):
        calls.append((params["agent_name"], params["offset"]))
        if params["agent_name"] == "is.null":
            return []
        if params["offset"] == "0":
            return [{"action": f"action-{index}"} for index in range(policy_store._PAGE_SIZE)]
        if params["offset"] == str(policy_store._PAGE_SIZE):
            return [{"action": "final-action"}]
        return []

    monkeypatch.setattr(policy_store, "_rest_get", fake_get)
    approved = await policy_store.resolve_active_approvals("workspace", "openclaw-bridge")

    assert "final-action" in approved
    assert ("eq.openclaw-bridge", str(policy_store._PAGE_SIZE)) in calls
