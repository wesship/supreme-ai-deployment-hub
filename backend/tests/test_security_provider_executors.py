import pytest

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS
from backend.app.security.provider_executors import (
    build_security_executors,
    cloudflare_block_ip_executor,
    dry_run_containment_executor,
)


def _clear_cloudflare(monkeypatch):
    monkeypatch.delenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ZONE_ID", raising=False)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)


def test_registry_is_empty_by_default(monkeypatch):
    monkeypatch.delenv("SECURITY_CONTAINMENT_DRY_RUN", raising=False)
    _clear_cloudflare(monkeypatch)
    assert build_security_executors() == {}


def test_registry_requires_explicit_true(monkeypatch):
    _clear_cloudflare(monkeypatch)
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    assert build_security_executors() == {}

    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    registry = build_security_executors()
    assert set(registry) == set(DESTRUCTIVE_ACTIONS)
    assert all(executor is dry_run_containment_executor for executor in registry.values())


def test_cloudflare_registry_requires_flag_and_complete_config(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "a" * 32)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    assert build_security_executors() == {}

    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
    registry = build_security_executors()
    assert registry == {"block_ip": cloudflare_block_ip_executor}


def test_cloudflare_rejects_invalid_zone_id(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "not-a-zone")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
    assert build_security_executors() == {}


def test_dry_run_takes_precedence_over_real_provider(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "a" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
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
async def test_dry_run_reads_block_ip_from_persisted_parameters(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    result = await dry_run_containment_executor({
        "action_type": "block_ip",
        "parameters": {"ip": "198.51.100.24", "actor": "user-123"},
    })

    assert result["status"] == "dry_run"
    assert result["target"] == "198.51.100.24"
    assert result["external_side_effect"] is False


@pytest.mark.asyncio
async def test_dry_run_reads_actor_for_account_containment(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    for action_type in ("revoke_token", "quarantine_account"):
        result = await dry_run_containment_executor({
            "action_type": action_type,
            "parameters": {"actor": "user-456"},
        })
        assert result["status"] == "dry_run"
        assert result["target"] == "user-456"
        assert result["external_side_effect"] is False


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
        "action_type": "revoke_token",
        "details": {"user_id": "user-123"},
    })

    assert result["status"] == "not_executed"
    assert result["provider"] == "dry_run"


@pytest.mark.asyncio
async def test_cloudflare_rejects_non_block_ip(monkeypatch):
    result = await cloudflare_block_ip_executor({"action_type": "revoke_token"})
    assert result["status"] == "rejected"
    assert result["provider"] == "cloudflare"


@pytest.mark.asyncio
async def test_cloudflare_rejects_invalid_ip_without_network(monkeypatch):
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "a" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
    result = await cloudflare_block_ip_executor({
        "action_type": "block_ip",
        "details": {"target": "not-an-ip"},
    })
    assert result["status"] == "rejected"
    assert result["provider"] == "cloudflare"


@pytest.mark.asyncio
async def test_cloudflare_posts_zone_scoped_block_rule(monkeypatch):
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "a" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")

    calls = []

    class FakeResponse:
        status_code = 200
        is_success = True

        def json(self):
            return {"success": True, "result": {"id": "rule-123"}}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, json):
            calls.append((url, headers, json))
            return FakeResponse()

    monkeypatch.setattr(
        "backend.app.security.provider_executors.httpx.AsyncClient",
        FakeClient,
    )

    result = await cloudflare_block_ip_executor({
        "id": "00000000-0000-0000-0000-000000000123",
        "action_type": "block_ip",
        "parameters": {"ip": "203.0.113.55"},
    })

    assert result["status"] == "success"
    assert result["provider"] == "cloudflare"
    assert result["external_side_effect"] is True
    assert result["provider_rule_id"] == "rule-123"
    assert len(calls) == 1
    url, headers, payload = calls[0]
    assert url.endswith("/zones/" + "a" * 32 + "/firewall/access_rules/rules")
    assert headers["Authorization"] == "Bearer test-token"
    assert payload["mode"] == "block"
    assert payload["configuration"] == {"target": "ip", "value": "203.0.113.55"}
