import pytest

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS
from backend.app.security.provider_executors import (
    build_security_executors,
    dry_run_containment_executor,
)


def test_registry_is_empty_by_default(monkeypatch):
    monkeypatch.delenv("SECURITY_CONTAINMENT_DRY_RUN", raising=False)
    assert build_security_executors() == {}


def test_registry_requires_explicit_true(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    assert build_security_executors() == {}

    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    registry = build_security_executors()
    assert set(registry) == set(DESTRUCTIVE_ACTIONS)
    assert all(executor is dry_run_containment_executor for executor in registry.values())


@pytest.mark.asyncio
async def test_dry_run_never_reports_external_side_effect(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    result = await dry_run_containment_executor({
        "action_type": "block_ip",
        "details": {"target": "203.0.113.10"},
    })

    assert result["status"] == "dry_run"
    assert result["provider"] == "dry_run"
    assert result["external_side_effect"] is False
    assert result["target"] == "203.0.113.10"


@pytest.mark.asyncio
async def test_dry_run_rejects_non_destructive_action(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    result = await dry_run_containment_executor({
        "action_type": "notify_admin",
        "details": {},
    })

    assert result["status"] == "rejected"
    assert result["provider"] == "dry_run"


@pytest.mark.asyncio
async def test_executor_itself_fails_closed_when_flag_disabled(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    result = await dry_run_containment_executor({
        "action_type": "revoke_sessions",
        "details": {"user_id": "user-123"},
    })

    assert result["status"] == "not_executed"
    assert result["provider"] == "dry_run"
