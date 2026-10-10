from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers import jockey_canary


def _client(monkeypatch) -> TestClient:
    monkeypatch.setattr(jockey_canary, "effective_webhook_secret", lambda: "test-secret-value-123456789")

    async def fake_query(parameters):
        assert parameters["mode"] == "reason"
        return {
            "status": "ok",
            "provider": "twelvelabs-jockey",
            "mode": "reason",
            "data": {"output": "sensitive film answer that must not escape"},
        }

    monkeypatch.setattr(jockey_canary, "_query_film_intelligence", fake_query)
    app = FastAPI()
    app.include_router(jockey_canary.router, prefix="/api")
    return TestClient(app)


def test_jockey_canary_rejects_invalid_secret(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/voice/jockey/certify",
        headers={"x-vapi-secret": "wrong"},
    )
    assert response.status_code == 401


def test_jockey_canary_runs_reasoning_without_returning_content(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/voice/jockey/certify",
        headers={"x-vapi-secret": "test-secret-value-123456789"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "ok": True,
        "provider": "twelvelabs-jockey",
        "mode": "reason",
        "round_trip": True,
        "content_returned": False,
    }
    assert "sensitive" not in response.text
