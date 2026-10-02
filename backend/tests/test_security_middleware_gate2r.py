from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from starlette.requests import Request

from backend.middleware.logging import LoggingMiddleware
from backend.middleware.multi_tenancy import MultiTenancyMiddleware
from backend.middleware.rate_limit import RateLimitMiddleware
from backend.middleware.request_context import RequestContextMiddleware


WORKSPACE_A = "11111111-1111-4111-8111-111111111111"
WORKSPACE_B = "22222222-2222-4222-8222-222222222222"


def _app(*middleware):
    app = FastAPI()
    for item in middleware:
        app.add_middleware(item)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/echo")
    async def echo():
        return {"status": "ok"}

    return app


def test_logging_and_request_context_do_not_break_requests():
    client = TestClient(_app(LoggingMiddleware, RequestContextMiddleware))
    response = client.get("/echo", headers={"X-Request-ID": "gate-2r-test"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "gate-2r-test"


def test_multi_tenancy_accepts_single_valid_workspace_context():
    client = TestClient(_app(MultiTenancyMiddleware))
    response = client.get(
        f"/echo?workspace_id={WORKSPACE_A}",
        headers={"X-Workspace-ID": WORKSPACE_A},
    )
    assert response.status_code == 200


def test_multi_tenancy_rejects_conflicting_workspace_context():
    client = TestClient(_app(MultiTenancyMiddleware))
    response = client.get(
        f"/echo?workspace_id={WORKSPACE_A}",
        headers={"X-Workspace-ID": WORKSPACE_B},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Conflicting workspace context"


def test_multi_tenancy_rejects_invalid_workspace_id():
    client = TestClient(_app(MultiTenancyMiddleware))
    response = client.get("/echo?workspace_id=not-a-uuid")
    assert response.status_code == 400


def test_rate_limiter_skips_health_without_redis(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "staging")
    client = TestClient(_app(RateLimitMiddleware))
    assert client.get("/health").status_code == 200


def test_rate_limiter_fails_closed_without_redis_in_staging(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "staging")
    client = TestClient(_app(RateLimitMiddleware))
    response = client.get("/echo")
    assert response.status_code == 503
    assert response.json()["detail"] == "Rate limiter unavailable"


def test_rate_limiter_fails_open_without_redis_in_local_dev(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    client = TestClient(_app(RateLimitMiddleware))
    assert client.get("/echo").status_code == 200


def test_unvalidated_tokens_and_forwarded_headers_share_client_allowance(monkeypatch):
    from backend.middleware import rate_limit

    class FakeRedis:
        def __init__(self):
            self.counts = {}

        async def incr(self, key):
            self.counts[key] = self.counts.get(key, 0) + 1
            return self.counts[key]

        async def expire(self, key, seconds):
            return True

    store = FakeRedis()
    monkeypatch.delenv("TRUST_RAILWAY_EDGE_CLIENT_IP", raising=False)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "2")
    monkeypatch.setattr(rate_limit.Redis, "from_url", lambda *a, **kw: store)
    monkeypatch.setattr(rate_limit.time, "time", lambda: 120)
    client = TestClient(_app(RateLimitMiddleware))
    for i, expected in enumerate((200, 200, 429)):
        response = client.get("/echo", headers={
            "Authorization": f"Bearer invalid-{i}",
            "X-Forwarded-For": f"192.0.2.{i}",
            "X-Real-IP": f"198.51.100.{i}",
        })
        assert response.status_code == expected
    assert len(store.counts) == 1


@pytest.mark.parametrize("enabled,project", [(False, True), (True, False), (False, False)])
def test_real_ip_requires_explicit_railway_deployment_boundary(monkeypatch, enabled, project):
    from backend.middleware.rate_limit import _client_identity
    monkeypatch.setenv("TRUST_RAILWAY_EDGE_CLIENT_IP", str(enabled).lower())
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "test-project" if project else "")
    request = Request({"type": "http", "client": ("10.0.0.1", 5000),
                       "headers": [(b"x-real-ip", b"203.0.113.1")]})
    assert _client_identity(request) == "ip:10.0.0.1"


@pytest.mark.parametrize("real_ip,expected", [("203.0.113.1", "ip:203.0.113.1"),
    ("2001:db8::1", "ip:2001:db8::1"), ("203.0.113.1, 203.0.113.2", "ip:10.0.0.1"),
    ("malformed", "ip:10.0.0.1")])
def test_railway_edge_client_ip_is_validated_and_isolates_clients(monkeypatch, real_ip, expected):
    from backend.middleware.rate_limit import _client_identity
    monkeypatch.setenv("TRUST_RAILWAY_EDGE_CLIENT_IP", "true")
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "test-project")
    request = Request({"type": "http", "client": ("10.0.0.1", 5000),
                       "headers": [(b"x-real-ip", real_ip.encode()), (b"x-forwarded-for", b"forged")]})
    assert _client_identity(request) == expected


def test_duplicate_edge_headers_do_not_create_an_allowance(monkeypatch):
    from backend.middleware.rate_limit import _client_identity
    monkeypatch.setenv("TRUST_RAILWAY_EDGE_CLIENT_IP", "true")
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "test-project")
    request = Request({"type": "http", "client": ("10.0.0.1", 5000),
                       "headers": [(b"x-real-ip", b"203.0.113.1"), (b"x-real-ip", b"203.0.113.2")]})
    assert _client_identity(request) == "ip:10.0.0.1"


def test_redis_failure_blocks_production_but_not_local(monkeypatch):
    from backend.middleware import rate_limit

    class BrokenRedis:
        async def incr(self, key):
            raise ConnectionError("shared limiter offline")

    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setattr(rate_limit.Redis, "from_url", lambda *a, **kw: BrokenRedis())
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert TestClient(_app(RateLimitMiddleware)).get("/echo").status_code == 503
    monkeypatch.setenv("ENVIRONMENT", "local")
    assert TestClient(_app(RateLimitMiddleware)).get("/echo").status_code == 200
