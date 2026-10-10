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
        "GOOGLE_CALENDAR_ACCESS_TOKEN",
        "GOOGLE_CALENDAR_ID",
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


def test_squad_manifest_has_seven_members_and_stays_unpublished():
    response = make_client().get("/api/voice/call-center/squad/manifest")
    assert response.status_code == 200
    body = response.json()
    assert body["member_count"] == 7
    assert body["published"] is False
    assert body["live_pstn_enabled"] is False
    scheduling = next(item for item in body["members"] if item["key"] == "scheduling")
    names = {tool["function"]["name"] for tool in scheduling["assistant"]["model"]["tools"]}
    assert {"get_available_slots", "book_appointment"} <= names


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
    assert body["tool_path_ready"] is False
    assert body["live_pstn_enabled"] is False
    assert body["secrets_exposed"] is False


def test_health_core_green_with_vapi_and_elevenlabs(monkeypatch):
    clear_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-real")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "eleven-real")
    response = make_client().get("/api/voice/call-center/health")
    assert response.status_code == 200
    assert response.json()["status"] == "configured"


def test_health_reports_operational_tool_path(monkeypatch):
    clear_env(monkeypatch)
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "vapi-real")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "eleven-real")
    monkeypatch.setenv("HUBSPOT_ACCESS_TOKEN", "hubspot-real")
    monkeypatch.setenv("GOOGLE_CALENDAR_ACCESS_TOKEN", "calendar-real")
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", "calendar@example.com")
    body = make_client().get("/api/voice/call-center/health").json()
    assert body["tool_path_ready"] is True
    assert all(body["operational_tools"].values())


def test_tool_authorization_blocks_wrong_agent():
    response = make_client().post(
        "/api/voice/call-center/tools/book_appointment",
        json={"call_id": "call-tool-1", "agent": "front_desk", "parameters": {"confirmed": True}},
    )
    assert response.status_code == 403


def test_booking_requires_explicit_confirmation(monkeypatch):
    monkeypatch.setenv("GOOGLE_CALENDAR_ACCESS_TOKEN", "calendar-real")
    monkeypatch.setenv("GOOGLE_CALENDAR_ID", "primary")
    response = make_client().post(
        "/api/voice/call-center/tools/book_appointment",
        json={
            "call_id": "call-tool-2",
            "agent": "scheduling",
            "parameters": {
                "start": "2026-09-08T14:00:00-06:00",
                "end": "2026-09-08T14:30:00-06:00",
                "confirmed": False,
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["result"]["status"] == "rejected"
    assert response.json()["result"]["reason"] == "explicit_confirmation_required"


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
