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
        "ELEVENLABS_DEFAULT_VOICE_ID",
        "HERMES_VOICE_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    response = make_client().get("/api/voice/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert body["checks"]["hermes_internal_adapter"] is True
    assert body["secrets_exposed"] is False


def test_health_reports_configured_with_required_provider_values(monkeypatch):
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-private-real-value")
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "webhook-real-value")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "eleven-real-value")
    monkeypatch.setenv("ELEVENLABS_DEFAULT_VOICE_ID", "voice-real-value")

    response = make_client().get("/api/voice/health")
    assert response.status_code == 200
    assert response.json()["status"] == "configured"


def test_webhook_rejects_invalid_auth(monkeypatch):
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "correct-secret")
    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"id": "evt-invalid-auth", "type": "status-update"},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert response.status_code == 401


def test_webhook_accepts_hmac_and_replays_cached_response(monkeypatch):
    monkeypatch.delenv("VAPI_WEBHOOK_SECRET", raising=False)
    monkeypatch.setenv("VAPI_SIGNING_SECRET", "signing-secret")
    monkeypatch.delenv("HERMES_VOICE_URL", raising=False)
    payload = {"id": "evt-hmac-cache", "type": "call-ended", "credential": "do-not-log"}
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
    assert first.json()["external_relay"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert second.json()["event_id"] == first.json()["event_id"]


def test_assistant_request_returns_published_assistant(monkeypatch):
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "assistant-secret")
    monkeypatch.delenv("VAPI_ASSISTANT_ID", raising=False)
    monkeypatch.delenv("VITE_VAPI_ASSISTANT_ID", raising=False)

    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"message": {"id": "evt-assistant-request", "type": "assistant-request"}},
        headers={"Authorization": "Bearer assistant-secret"},
    )

    assert response.status_code == 200
    assert response.json()["assistantId"] == "8491eea7-e385-426b-8cdc-3e2aaf9a4cbf"


def test_unknown_tool_is_rejected_with_vapi_result_shape(monkeypatch):
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "tool-secret")
    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={
            "message": {
                "id": "evt-unknown-tool",
                "type": "tool-calls",
                "toolCallList": [{"id": "call-1", "name": "delete_everything", "parameters": {}}],
            }
        },
        headers={"Authorization": "Bearer tool-secret"},
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["toolCallId"] == "call-1"
    assert json.loads(result["result"])["status"] == "rejected"


def test_hermes_tool_queues_task_and_returns_result(monkeypatch):
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "queue-secret")

    async def fake_create_task(**kwargs):
        return {"id": "task-123", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={
            "message": {
                "id": "evt-hermes-tool",
                "type": "tool-calls",
                "toolCallList": [
                    {
                        "id": "call-2",
                        "name": "create_hermes_task",
                        "parameters": {"title": "Research a new lead", "description": "Voice request"},
                    }
                ],
            }
        },
        headers={"Authorization": "Bearer queue-secret"},
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    decoded = json.loads(result["result"])
    assert decoded["status"] == "queued"
    assert decoded["task_id"] == "task-123"
