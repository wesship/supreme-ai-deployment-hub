from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.call_center import AGENTS, router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


def clear_env(monkeypatch) -> None:
    for name in (
        "VAPI_PRIVATE_KEY",
        "VAPI_API_KEY",
        "ELEVENLABS_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "HUBSPOT_ACCESS_TOKEN",
        "HUBSPOT_PRIVATE_APP_TOKEN",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        "GOOGLE_CALENDAR_CREDENTIALS_JSON",
        "GOOGLE_CLIENT_ID",
        "N8N_WEBHOOK_URL",
        "N8N_BASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_agent_manifest_has_seven_specialists():
    response = make_client().get("/api/voice/call-center/agents")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 7
    assert set(body["agents"]) == set(AGENTS)
    assert body["orchestration"]["realtime_owner"] == "vapi"
    assert body["orchestration"]["business_control_plane"] == "hermes"
    assert body["orchestration"]["async_automation"] == "n8n"


def test_health_is_partial_without_provider_credentials(monkeypatch):
    clear_env(monkeypatch)
    response = make_client().get("/api/voice/call-center/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert body["agents_ready"] is True
    assert body["providers"]["vapi"] is False
    assert body["providers"]["elevenlabs"] is False
    assert body["providers"]["hermes"] is True
    assert body["secrets_exposed"] is False


def test_health_core_green_with_vapi_and_elevenlabs(monkeypatch):
    clear_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-real")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "eleven-real")
    response = make_client().get("/api/voice/call-center/health")
    assert response.status_code == 200
    assert response.json()["status"] == "configured"


def test_handoff_rejects_unknown_agent():
    response = make_client().post(
        "/api/voice/call-center/handoff",
        json={
            "call_id": "call-1",
            "from_agent": "front_desk",
            "to_agent": "root_agent",
            "reason": "invalid target",
        },
    )
    assert response.status_code == 422


def test_handoff_returns_context_packet(monkeypatch):
    async def fake_log_event(**kwargs):
        return None

    monkeypatch.setattr("backend.hermes.task_engine.log_event", fake_log_event)
    response = make_client().post(
        "/api/voice/call-center/handoff",
        json={
            "call_id": "call-2",
            "from_agent": "front_desk",
            "to_agent": "scheduling",
            "reason": "caller wants to book a demo",
            "customer_id": "customer-9",
            "intent": "schedule_demo",
            "confidence": 0.98,
            "summary": "Qualified caller wants Tuesday afternoon.",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["hermes_recorded"] is True
    assert body["handoff_packet"]["intent"] == "schedule_demo"
    assert body["handoff_packet"]["confidence"] == 0.98


def test_lifecycle_event_records_to_hermes(monkeypatch):
    captured = {}

    async def fake_log_event(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr("backend.hermes.task_engine.log_event", fake_log_event)
    response = make_client().post(
        "/api/voice/call-center/events",
        json={
            "call_id": "call-3",
            "event_type": "intent.detected",
            "agent": "front_desk",
            "intent": "support",
            "payload": {"confidence": 0.91},
        },
    )
    assert response.status_code == 200
    assert response.json()["hermes_recorded"] is True
    assert captured["event"] == "voice.call_center.intent.detected"
    assert captured["correlation_id"] == "call-3"
