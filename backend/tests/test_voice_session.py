from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.voice_orchestration import router
from backend.app.voice_session import issue_voice_session, verify_voice_session


def make_client(user_id: str = "user-voice-123") -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    return TestClient(app)


def configure_signing(monkeypatch) -> None:
    monkeypatch.setenv("VOICE_SESSION_SIGNING_SECRET", "voice-session-signing-secret-value")
    monkeypatch.setenv("VAPI_PRIVATE_KEY", "invalid-but-secret-vapi-value")
    monkeypatch.setenv("ELEVENLABS_DEFAULT_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")


def test_voice_session_token_round_trip_and_tamper_rejection(monkeypatch):
    configure_signing(monkeypatch)
    token, expires_at = issue_voice_session("user-round-trip", ttl_seconds=600)

    claims = verify_voice_session(token)
    assert claims is not None
    assert claims["sub"] == "user-round-trip"
    assert claims["exp"] == expires_at
    assert verify_voice_session(f"{token[:-1]}x") is None
    assert verify_voice_session("") is None


def test_authenticated_session_returns_browser_safe_inline_assistant(monkeypatch):
    configure_signing(monkeypatch)
    response = make_client().post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, private"
    body = response.json()
    assert body["mode"] == "inline-authenticated"
    assistant = body["assistant"]
    assert assistant["voice"]["provider"] == "11labs"
    assert assistant["voice"]["voiceId"] == "21m00Tcm4TlvDq8ikWAM"
    assert assistant["model"]["provider"] == "openai"
    tool_names = [tool["function"]["name"] for tool in assistant["model"]["tools"]]
    assert "create_hermes_task" in tool_names
    assert "query_film_intelligence" in tool_names
    assert "secret" not in assistant["server"]
    assert "session=" in assistant["server"]["url"]
    assert "invalid-but-secret-vapi-value" not in json.dumps(body)
    assert "voice-session-signing-secret-value" not in json.dumps(body)


def test_session_token_authenticates_webhook_and_binds_user(monkeypatch):
    configure_signing(monkeypatch)
    client = make_client(user_id="user-bound-to-call")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
    )
    server_url = session_response.json()["assistant"]["server"]["url"]
    token = parse_qs(urlparse(server_url).query)["session"][0]

    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={"message": {"id": "evt-inline-session", "type": "status-update"}},
    )

    assert response.status_code == 200
    assert response.json()["authenticated_session"] is True
    assert response.json()["event_id"] == "evt-inline-session"


def test_inline_tool_call_queues_user_bound_hermes_task(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "inline-task-123", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    client = make_client(user_id="user-hermes-inline")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
    )
    token = parse_qs(
        urlparse(session_response.json()["assistant"]["server"]["url"]).query
    )["session"][0]

    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-inline-tool",
                "type": "tool-calls",
                "toolCallList": [
                    {
                        "id": "call-inline-1",
                        "name": "create_hermes_task",
                        "parameters": {
                            "title": "Inspect a production incident",
                            "description": "Find the root cause and report remediation.",
                        },
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    result = json.loads(response.json()["results"][0]["result"])
    assert result["status"] == "queued"
    assert result["task_id"] == "inline-task-123"
    assert captured["source"] == "vapi-inline"
    assert captured["input_data"]["authenticated_user_id"] == "user-hermes-inline"


def test_inline_jockey_tool_uses_server_side_twelvelabs(monkeypatch):
    configure_signing(monkeypatch)
    monkeypatch.setenv("TWELVELABS_API_KEY", "server-only-twelvelabs-key")
    monkeypatch.setenv("TWELVELABS_KNOWLEDGE_STORE_ID", "ks_voice_films")
    observed: dict[str, object] = {}

    async def fake_reason(self, message, *, session_id=None, instructions=None, include_intermediate=False):
        observed["message"] = message
        observed["instructions"] = instructions
        observed["include_intermediate"] = include_intermediate
        return {
            "id": "resp_voice_jockey",
            "output": [{"type": "message", "content": "Continuity is preserved."}],
        }

    monkeypatch.setattr("backend.ai_films.twelvelabs.TwelveLabsClient.reason", fake_reason)
    client = make_client(user_id="user-jockey-inline")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
    )
    token = parse_qs(
        urlparse(session_response.json()["assistant"]["server"]["url"]).query
    )["session"][0]

    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-inline-jockey",
                "type": "tool-calls",
                "toolCallList": [
                    {
                        "id": "call-jockey-1",
                        "name": "query_film_intelligence",
                        "parameters": {
                            "query": "Check Legend wardrobe continuity.",
                            "mode": "reason",
                            "instructions": "Use only indexed footage.",
                        },
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    result_text = response.json()["results"][0]["result"]
    assert "server-only-twelvelabs-key" not in result_text
    result = json.loads(result_text)
    assert result["status"] == "ok"
    assert result["provider"] == "twelvelabs-jockey"
    assert result["mode"] == "reason"
    assert observed["message"] == "Check Legend wardrobe continuity."
    assert observed["instructions"] == "Use only indexed footage."
    assert observed["include_intermediate"] is False


def test_invalid_session_token_is_rejected_without_provider_headers(monkeypatch):
    configure_signing(monkeypatch)
    response = make_client().post(
        "/api/voice/vapi/webhook?session=not-a-valid-session",
        json={"message": {"id": "evt-invalid-session", "type": "status-update"}},
    )
    assert response.status_code == 401
