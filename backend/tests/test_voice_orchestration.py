from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.voice_orchestration import router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


def test_health_reports_partial_without_secrets(monkeypatch):
    for name in (
        "VAPI_ASSISTANT_ID",
        "VITE_VAPI_ASSISTANT_ID",
        "VAPI_PRIVATE_KEY",
        "VAPI_API_KEY",
        "VAPI_WEBHOOK_SECRET",
        "VAPI_SIGNING_SECRET",
        "ELEVENLABS_API_KEY",
        "HERMES_VOICE_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    response = make_client().get("/api/voice/health")
    assert response.status_code == 200
    assert response.json()["status"] == "partial"
    assert response.json()["secrets_exposed"] is False


def test_webhook_rejects_invalid_auth(monkeypatch):
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "correct-secret")
    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"id": "evt-1", "type": "status-update"},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert response.status_code == 401


def test_webhook_accepts_hmac_and_deduplicates(monkeypatch):
    monkeypatch.delenv("VAPI_WEBHOOK_SECRET", raising=False)
    monkeypatch.setenv("VAPI_SIGNING_SECRET", "signing-secret")
    monkeypatch.delenv("HERMES_VOICE_URL", raising=False)
    payload = {"id": "evt-hmac-unique", "type": "call-ended", "credential": "do-not-log"}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(b"signing-secret", raw, hashlib.sha256).hexdigest()

    client = make_client()
    first = client.post(
        "/api/voice/vapi/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "x-vapi-signature": f"sha256={signature}"},
    )
    second = client.post(
        "/api/voice/vapi/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "x-vapi-signature": f"sha256={signature}"},
    )

    assert first.status_code == 200
    assert first.json()["relayed"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
