import pytest

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS
from backend.app.security.provider_executors import (
    build_security_executors,
    cloudflare_block_ip_executor,
    cloudflare_waf_block_ip_executor,
    dry_run_containment_executor,
)


def _clear_cloudflare(monkeypatch):
    monkeypatch.delenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", raising=False)
    monkeypatch.delenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", raising=False)
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


def test_cloudflare_waf_registry_requires_flag_and_complete_config(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "b" * 32)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    assert build_security_executors() == {}

    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "waf-token")
    assert build_security_executors() == {"block_ip": cloudflare_waf_block_ip_executor}


def test_cloudflare_waf_precedes_legacy_adapter(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "c" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
    assert build_security_executors() == {"block_ip": cloudflare_waf_block_ip_executor}


def test_cloudflare_rejects_invalid_zone_id(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "false")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "not-a-zone")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "test-token")
    assert build_security_executors() == {}


def test_dry_run_takes_precedence_over_real_provider(monkeypatch):
    monkeypatch.setenv("SECURITY_CONTAINMENT_DRY_RUN", "true")
    monkeypatch.setenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", "true")
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
    assert result["external_side_effect"] is False


@pytest.mark.asyncio
async def test_cloudflare_rejects_non_block_ip(monkeypatch):
    result = await cloudflare_block_ip_executor({"action_type": "revoke_token"})
    assert result["status"] == "rejected"


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
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): return False
        async def post(self, url, headers, json):
            calls.append((url, headers, json))
            return FakeResponse()

    monkeypatch.setattr("backend.app.security.provider_executors.httpx.AsyncClient", FakeClient)
    result = await cloudflare_block_ip_executor({
        "id": "00000000-0000-0000-0000-000000000123",
        "action_type": "block_ip",
        "parameters": {"ip": "203.0.113.55"},
    })
    assert result["status"] == "success"
    assert result["provider_mode"] == "ip_access_rule"
    assert calls[0][0].endswith("/firewall/access_rules/rules")


@pytest.mark.asyncio
async def test_cloudflare_waf_requires_existing_entrypoint(monkeypatch):
    monkeypatch.setenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "b" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "waf-token")

    class NotFound:
        status_code = 404
        is_success = False
        def json(self): return {"success": False}

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): return False
        async def get(self, url, headers): return NotFound()

    monkeypatch.setattr("backend.app.security.provider_executors.httpx.AsyncClient", FakeClient)
    result = await cloudflare_waf_block_ip_executor({
        "action_type": "block_ip",
        "parameters": {"ip": "198.51.100.5"},
    })
    assert result["status"] == "not_executed"
    assert "bootstrap" in result["reason"].lower()


@pytest.mark.asyncio
async def test_cloudflare_waf_adds_custom_block_rule(monkeypatch):
    monkeypatch.setenv("SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED", "true")
    monkeypatch.setenv("CLOUDFLARE_ZONE_ID", "b" * 32)
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "waf-token")
    calls = []

    class EntryPoint:
        status_code = 200
        is_success = True
        def json(self):
            return {"success": True, "result": {"id": "ruleset-123"}}

    class AddedRule:
        status_code = 200
        is_success = True
        def json(self):
            return {"success": True, "result": {"id": "waf-rule-456"}}

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): return False
        async def get(self, url, headers):
            calls.append(("GET", url, headers, None))
            return EntryPoint()
        async def post(self, url, headers, json):
            calls.append(("POST", url, headers, json))
            return AddedRule()

    monkeypatch.setattr("backend.app.security.provider_executors.httpx.AsyncClient", FakeClient)
    result = await cloudflare_waf_block_ip_executor({
        "id": "00000000-0000-0000-0000-000000000999",
        "action_type": "block_ip",
        "parameters": {"ip": "203.0.113.77"},
    })

    assert result["status"] == "success"
    assert result["provider_mode"] == "waf_custom_rule"
    assert result["provider_ruleset_id"] == "ruleset-123"
    assert result["provider_rule_id"] == "waf-rule-456"
    assert calls[0][0] == "GET"
    assert calls[0][1].endswith("/rulesets/phases/http_request_firewall_custom/entrypoint")
    assert calls[1][0] == "POST"
    assert calls[1][1].endswith("/rulesets/ruleset-123/rules")
    assert calls[1][2]["Authorization"] == "Bearer waf-token"
    assert calls[1][3]["action"] == "block"
    assert calls[1][3]["expression"] == "(ip.src eq 203.0.113.77)"
