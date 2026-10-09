"""Contract tests for the opt-in public preview; no provider calls."""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock
from backend.app.routers import public_agent_preview as preview

def make_client():
    app = FastAPI()
    app.include_router(preview.router)
    return TestClient(app)

def test_disabled_by_default(monkeypatch):
    monkeypatch.delenv("PUBLIC_AI_DEMO_ENABLED", raising=False)
    response = make_client().post("/api/public/agent-preview", headers={"Origin": "https://www.d3vonn.io"}, json={"prompt": "Hello"})
    assert response.status_code == 503

def test_missing_origin_rejected(monkeypatch):
    monkeypatch.setenv("PUBLIC_AI_DEMO_ENABLED", "true")
    response = make_client().post("/api/public/agent-preview", json={"prompt": "Hello"})
    assert response.status_code == 403

def test_foreign_origin_rejected(monkeypatch):
    monkeypatch.setenv("PUBLIC_AI_DEMO_ENABLED", "true")
    response = make_client().post("/api/public/agent-preview", headers={"Origin": "https://untrusted.example"}, json={"prompt": "Hello"})
    assert response.status_code == 403

def test_oversized_prompt_rejected(monkeypatch):
    monkeypatch.setenv("PUBLIC_AI_DEMO_ENABLED", "true")
    response = make_client().post("/api/public/agent-preview", headers={"Origin": "https://www.d3vonn.io"}, json={"prompt": "x" * 501})
    assert response.status_code == 422

def test_no_limiter_fails_closed(monkeypatch):
    monkeypatch.setenv("PUBLIC_AI_DEMO_ENABLED", "true")
    monkeypatch.delenv("REDIS_URL", raising=False)
    response = make_client().post("/api/public/agent-preview", headers={"Origin": "https://www.d3vonn.io"}, json={"prompt": "Hello"})
    assert response.status_code == 503
