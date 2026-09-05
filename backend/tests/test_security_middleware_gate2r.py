from __future__ import annotations

import os

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
