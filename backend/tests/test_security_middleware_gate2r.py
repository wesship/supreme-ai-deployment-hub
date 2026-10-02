from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

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
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "2")
    monkeypatch.setattr(rate_limit.Redis, "from_url", lambda *a, **kw: store)
    monkeypatch.setattr(rate_limit.time, "time", lambda: 120)
    client = TestClient(_app(RateLimitMiddleware))
    for i, expected in enumerate((200, 200, 429)):
        response = client.get("/echo", headers={
            "Authorization": f"Bearer invalid-{i}",
            "X-Forwarded-For": f"192.0.2.{i}",
        })
        assert response.status_code == expected
    assert len(store.counts) == 1


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
