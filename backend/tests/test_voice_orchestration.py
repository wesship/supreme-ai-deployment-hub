from __future__ import annotations

# This suite is also the protected production voice certification trigger.

import hashlib
import hmac
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.voice_orchestration import effective_webhook_secret, router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


def clear_voice_env(monkeypatch) -> None:
    for name in (
        "VAPI_ASSISTANT_ID",
        "VITE_VAPI_ASSISTANT_ID",
        "VAPI_PRIVATE_KEY",
        "VAPI_API_KEY",
        "VAPI_WEBHOOK_SECRET",
        "VAPI_SIGNING_SECRET",
        "ELEVENLABS_API_KEY",
        "ELEVENLABS_DEFAULT_VOICE_ID",
        "ELEVENLABS_VOICE_ID",
        "HERMES_VOICE_URL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_health_reports_partial_without_provider_secrets(monkeypatch):
    clear_voice_env(monkeypatch)

    response = make_client().get("/api/voice/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert body["checks"]["vapi_private_key"] is False
    assert body["checks"]["vapi_webhook_auth"] is False
    assert body["checks"]["elevenlabs_api"] is False
    assert body["checks"]["hermes_internal_adapter"] is True
    assert body["webhook_auth_mode"] == "unavailable"
    assert body["secrets_exposed"] is False


def test_health_uses_defaults_and_derived_auth_with_provider_keys(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-private-real-value")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "eleven-real-value")

    response = make_client().get("/api/voice/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "configured"
    assert body["checks"]["vapi_webhook_auth"] is True
    assert body["checks"]["elevenlabs_voice"] is True
    assert body["webhook_auth_mode"] == "derived"


def test_effective_webhook_secret_is_deterministic_and_explicit_wins(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-private-real-value")

    first = effective_webhook_secret()
    second = effective_webhook_secret()
    assert first == second
    assert len(first) == 64

    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "explicit-webhook-secret")
    assert effective_webhook_secret() == "explicit-webhook-secret"


def test_webhook_accepts_derived_server_secret(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-private-real-value")
    secret = effective_webhook_secret()

    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"message": {"id": "evt-derived-secret", "type": "status-update"}},
        headers={"x-vapi-secret": secret},
    )

    assert response.status_code == 200
    assert response.json()["event_type"] == "status-update"


def test_webhook_rejects_invalid_auth(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "correct-secret")
    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"id": "evt-invalid-auth", "type": "status-update"},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert response.status_code == 401


def test_webhook_accepts_vapi_server_secret_header(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "server-secret")

    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"message": {"id": "evt-server-secret", "type": "status-update"}},
        headers={"x-vapi-secret": "server-secret"},
    )

    assert response.status_code == 200
    assert response.json()["event_type"] == "status-update"


def test_webhook_accepts_hmac_and_replays_cached_response(monkeypatch):
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_SIGNING_SECRET", "signing-secret")
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
    clear_voice_env(monkeypatch)
    monkeypatch.setenv("VAPI_WEBHOOK_SECRET", "assistant-secret")

    response = make_client().post(
        "/api/voice/vapi/webhook",
        json={"message": {"id": "evt-assistant-request", "type": "assistant-request"}},
        headers={"Authorization": "Bearer assistant-secret"},
    )

    assert response.status_code == 200
    assert response.json()["assistantId"] == "8491eea7-e385-426b-8cdc-3e2aaf9a4cbf"


def test_unknown_tool_is_rejected_with_vapi_result_shape(monkeypatch):
    clear_voice_env(monkeypatch)
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
    clear_voice_env(monkeypatch)
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
