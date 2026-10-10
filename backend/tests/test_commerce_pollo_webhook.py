from __future__ import annotations

from typing import Any

import pytest

from backend.ai_films import commerce_router


def test_normalize_pollo_status_matches_database_constraint():
    assert commerce_router._normalize_pollo_status("success") == "succeeded"
    assert commerce_router._normalize_pollo_status("succeeded") == "succeeded"
    assert commerce_router._normalize_pollo_status("completed") == "completed"
    assert commerce_router._normalize_pollo_status("waiting") == "processing"
    assert commerce_router._normalize_pollo_status("queued") == "processing"
    assert commerce_router._normalize_pollo_status("running") == "processing"
    assert commerce_router._normalize_pollo_status("error") == "failed"
    assert commerce_router._normalize_pollo_status("canceled") == "cancelled"
    assert commerce_router._normalize_pollo_status("unexpected-provider-state") == "processing"


@pytest.mark.asyncio
async def test_dispatch_keeps_internal_webhook_authoritative(monkeypatch):
    captured: dict[str, Any] = {}

    async def require_user(_authorization):
        return "user-1"

    def no_op(_user_id):
        return None

    async def user_update(_token, _table, payload, _row_id):
        captured["update"] = payload

    class FakeDb:
        def __init__(self, _token):
            pass

        async def insert(self, _table, payload):
            captured["reservation"] = payload
            return {"id": "job-1"}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"taskId": "task-1", "status": "waiting"}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, *, json, headers):
            captured["url"] = url
            captured["payload"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(commerce_router, "_require_user", require_user)
    monkeypatch.setattr(commerce_router, "_require_pollo_entitlement", no_op)
    monkeypatch.setattr(commerce_router, "_check_pollo_rate_limit", no_op)
    monkeypatch.setattr(commerce_router, "_user_update", user_update)
    monkeypatch.setattr(commerce_router, "SupabaseRLSClient", FakeDb)
    monkeypatch.setattr(commerce_router.httpx, "AsyncClient", FakeClient)
    monkeypatch.setenv("POLLO_API_KEY", "test-key")
    monkeypatch.setenv("POLLO_WEBHOOK_URL", "https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook")
    monkeypatch.setenv("POLLO_WEBHOOK_SECRET", "dGVzdC1zZWNyZXQ=")

    request = commerce_router.PolloDispatchRequest(
        prompt="Create a polished product hero video for testing.",
        webhook_url="https://customer.example/callback",
    )
    result = await commerce_router.dispatch_pollo(request, authorization="Bearer test-token")

    assert result["job_id"] == "job-1"
    assert captured["payload"]["webhookUrl"] == "https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook"
    assert captured["reservation"]["request"]["webhook_url"] == "https://customer.example/callback"


@pytest.mark.asyncio
async def test_dispatch_surfaces_pollo_403_instead_of_generic_502(monkeypatch):
    """Regression test: a 403 (or 401/404/422/429) from Pollo must reach the
    caller as that real status code with the upstream body attached, not be
    flattened into a generic 502 that hides the actual cause."""
    captured: dict[str, Any] = {}

    async def require_user(_authorization):
        return "user-1"

    def no_op(_user_id):
        return None

    async def user_update(_token, _table, payload, _row_id):
        captured["update"] = payload

    class FakeDb:
        def __init__(self, _token):
            pass

        async def insert(self, _table, payload):
            return {"id": "job-1"}

    class FakeResponse:
        status_code = 403

        def raise_for_status(self):
            import httpx

            raise httpx.HTTPStatusError("Forbidden", request=None, response=self)

        def json(self):
            return {"error": "entitlement_not_configured", "message": "Account lacks pollo-v2-5 access"}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, *, json, headers):
            return FakeResponse()

    monkeypatch.setattr(commerce_router, "_require_user", require_user)
    monkeypatch.setattr(commerce_router, "_require_pollo_entitlement", no_op)
    monkeypatch.setattr(commerce_router, "_check_pollo_rate_limit", no_op)
    monkeypatch.setattr(commerce_router, "_user_update", user_update)
    monkeypatch.setattr(commerce_router, "SupabaseRLSClient", FakeDb)
    monkeypatch.setattr(commerce_router.httpx, "AsyncClient", FakeClient)
    monkeypatch.setenv("POLLO_API_KEY", "test-key")
    monkeypatch.setenv("POLLO_WEBHOOK_URL", "https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook")
    monkeypatch.setenv("POLLO_WEBHOOK_SECRET", "dGVzdC1zZWNyZXQ=")

    request = commerce_router.PolloDispatchRequest(prompt="Create a polished product hero video for testing.")
    with pytest.raises(commerce_router.HTTPException) as exc_info:
        await commerce_router.dispatch_pollo(request, authorization="Bearer test-token")

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["upstream_status"] == 403
    assert exc_info.value.detail["upstream_body"]["error"] == "entitlement_not_configured"
    assert captured["update"]["status"] == "failed"
    assert "403" in captured["update"]["error_message"]


@pytest.mark.asyncio
async def test_dispatch_fails_before_reservation_without_internal_webhook(monkeypatch):
    inserted = False

    async def require_user(_authorization):
        return "user-1"

    def no_op(_user_id):
        return None

    class FakeDb:
        def __init__(self, _token):
            pass

        async def insert(self, _table, _payload):
            nonlocal inserted
            inserted = True
            return {"id": "job-1"}

    monkeypatch.setattr(commerce_router, "_require_user", require_user)
    monkeypatch.setattr(commerce_router, "_require_pollo_entitlement", no_op)
    monkeypatch.setattr(commerce_router, "_check_pollo_rate_limit", no_op)
    monkeypatch.setattr(commerce_router, "SupabaseRLSClient", FakeDb)
    monkeypatch.setenv("POLLO_API_KEY", "test-key")
    monkeypatch.setenv("POLLO_WEBHOOK_SECRET", "dGVzdC1zZWNyZXQ=")
    monkeypatch.delenv("POLLO_WEBHOOK_URL", raising=False)

    request = commerce_router.PolloDispatchRequest(prompt="Create a polished product hero video for testing.")
    with pytest.raises(commerce_router.HTTPException) as exc_info:
        await commerce_router.dispatch_pollo(request, authorization="Bearer test-token")

    assert exc_info.value.status_code == 503
    assert inserted is False


@pytest.mark.asyncio
async def test_dispatch_fails_before_reservation_without_webhook_secret(monkeypatch):
    inserted = False
    provider_called = False

    async def require_user(_authorization):
        return "user-1"

    def no_op(_user_id):
        return None

    class FakeDb:
        def __init__(self, _token):
            pass

        async def insert(self, _table, _payload):
            nonlocal inserted
            inserted = True
            return {"id": "job-1"}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            nonlocal provider_called
            provider_called = True
            raise AssertionError("provider must not be called without webhook secret")

    monkeypatch.setattr(commerce_router, "_require_user", require_user)
    monkeypatch.setattr(commerce_router, "_require_pollo_entitlement", no_op)
    monkeypatch.setattr(commerce_router, "_check_pollo_rate_limit", no_op)
    monkeypatch.setattr(commerce_router, "SupabaseRLSClient", FakeDb)
    monkeypatch.setattr(commerce_router.httpx, "AsyncClient", FakeClient)
    monkeypatch.setenv("POLLO_API_KEY", "test-key")
    monkeypatch.setenv("POLLO_WEBHOOK_URL", "https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook")
    monkeypatch.delenv("POLLO_WEBHOOK_SECRET", raising=False)

    request = commerce_router.PolloDispatchRequest(prompt="Create a polished product hero video for testing.")
    with pytest.raises(commerce_router.HTTPException) as exc_info:
        await commerce_router.dispatch_pollo(request, authorization="Bearer test-token")

    assert exc_info.value.status_code == 503
    assert inserted is False
    assert provider_called is False
