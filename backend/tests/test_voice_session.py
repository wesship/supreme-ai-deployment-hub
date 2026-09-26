from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse
from uuid import UUID

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
    payload, signature = token.split(".", 1)
    changed_first_char = "A" if signature[0] != "A" else "B"
    assert verify_voice_session(f"{payload}.{changed_first_char}{signature[1:]}") is None

    # A SHA-256 signature has two unused pad bits in its final base64url digit.
    # Toggling one must not produce a second valid spelling of the same token.
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    alternate_last_char = alphabet[alphabet.index(signature[-1]) ^ 1]
    assert verify_voice_session(f"{payload}.{signature[:-1]}{alternate_last_char}") is None
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


def test_authenticated_session_binds_signed_graph_context(monkeypatch):
    configure_signing(monkeypatch)
    client = make_client(user_id="user-context-bound")
    context = {
        "surface": "knowledge-graph",
        "route": "/knowledge-graph",
        "node_id": "hermes",
        "node_label": "Hermes",
        "node_kind": "core",
        "canonical_route": "/workflows",
    }
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={"context": context},
    )

    assert session_response.status_code == 200
    assistant = session_response.json()["assistant"]
    system_message = assistant["model"]["messages"][0]["content"]
    assert "Current signed UI context" in system_message
    assert '"node_id":"hermes"' in system_message

    token = parse_qs(urlparse(assistant["server"]["url"]).query)["session"][0]
    claims = verify_voice_session(token)
    assert claims is not None
    assert claims["context"] == context


def test_context_bound_tool_call_carries_voice_context_into_hermes(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "inline-task-context", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    client = make_client(user_id="user-context-tool")
    context = {
        "surface": "knowledge-graph",
        "route": "/knowledge-graph",
        "node_id": "radio",
        "node_label": "HNF Radio",
        "node_kind": "product",
        "canonical_route": "/music",
    }
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={"context": context},
    )
    token = parse_qs(
        urlparse(session_response.json()["assistant"]["server"]["url"]).query
    )["session"][0]

    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-context-tool",
                "type": "tool-calls",
                "toolCallList": [
                    {
                        "id": "call-context-1",
                        "name": "create_hermes_task",
                        "parameters": {
                            "title": "Monitor this",
                            "description": "Inspect current status and report anomalies.",
                        },
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    assert captured["input_data"]["voice_context"] == context
    assert captured["input_data"]["authenticated_user_id"] == "user-context-tool"


def test_invalid_voice_context_is_rejected(monkeypatch):
    configure_signing(monkeypatch)
    response = make_client().post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={"context": {"route": "not-a-route"}},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid voice context"


def test_voice_tool_returns_uuid_correlation_for_live_graph(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "inline-task-live-graph", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    client = make_client(user_id="user-live-graph")
    ui_session_id = "11111111-1111-4111-8111-111111111111"
    context = {
        "surface": "knowledge-graph",
        "route": "/knowledge-graph",
        "node_id": "films",
        "node_label": "AI Films",
        "node_kind": "product",
        "canonical_route": "/ai-films",
        "ui_session_id": ui_session_id,
    }
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={"context": context},
    )
    token = parse_qs(
        urlparse(session_response.json()["assistant"]["server"]["url"]).query
    )["session"][0]

    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-live-graph-tool",
                "type": "tool-calls",
                "toolCallList": [
                    {
                        "id": "call-live-graph-1",
                        "name": "create_hermes_task",
                        "parameters": {"title": "Run this"},
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    result = json.loads(response.json()["results"][0]["result"])
    correlation_id = result["correlation_id"]
    assert str(UUID(correlation_id)) == correlation_id
    assert captured["correlation_id"] == correlation_id
    assert captured["input_data"]["voice_context"]["ui_session_id"] == ui_session_id
    assert captured["input_data"]["vapi_event_id"] == "evt-live-graph-tool"


def test_latest_voice_execution_is_user_and_ui_session_scoped(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}
    ui_session_id = "22222222-2222-4222-8222-222222222222"

    class Repository:
        configured = True

        async def list_rows(self, table, params):
            captured["table"] = table
            captured["params"] = params
            return [{
                "id": "task-live-1",
                "correlation_id": "33333333-3333-4333-8333-333333333333",
                "created_at": "2026-09-26T22:00:00+00:00",
                "input_data": {},
            }]

    class Dependencies:
        repository = Repository()

    monkeypatch.setattr(
        "backend.app.routers.voice_orchestration.get_dependencies",
        lambda: Dependencies(),
    )

    response = make_client(user_id="user-execution-owner").get(
        "/api/voice/executions/latest",
        params={"ui_session_id": ui_session_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["execution"]["correlation_id"] == "33333333-3333-4333-8333-333333333333"
    assert captured["table"] == "hermes_tasks"
    assert captured["params"]["input_data->>authenticated_user_id"] == "eq.user-execution-owner"
    assert captured["params"]["input_data->voice_context->>ui_session_id"] == f"eq.{ui_session_id}"


def test_latest_voice_execution_rejects_invalid_ui_session(monkeypatch):
    configure_signing(monkeypatch)
    response = make_client().get(
        "/api/voice/executions/latest",
        params={"ui_session_id": "not-a-valid-uuid"},
    )
    assert response.status_code == 422


def test_inline_assistant_exposes_first_class_graph_action_tool(monkeypatch):
    configure_signing(monkeypatch)
    response = make_client().post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={
            "context": {
                "surface": "knowledge-graph",
                "route": "/knowledge-graph",
                "node_id": "films",
                "node_label": "AI Films",
                "node_kind": "product",
                "canonical_route": "/ai-films",
                "ui_session_id": "44444444-4444-4444-8444-444444444444",
            }
        },
    )
    assert response.status_code == 200
    tools = response.json()["assistant"]["model"]["tools"]
    graph_tool = next(tool for tool in tools if tool["function"]["name"] == "graph_action")
    enum = graph_tool["function"]["parameters"]["properties"]["action"]["enum"]
    assert enum == [
        "open", "select", "trace", "run", "monitor", "connect",
        "expand", "filter", "search", "ask", "stop",
    ]


def test_read_only_graph_action_does_not_create_hermes_task(monkeypatch):
    configure_signing(monkeypatch)

    async def unexpected_create_task(**kwargs):
        raise AssertionError("read-only graph action must not create a Hermes task")

    monkeypatch.setattr("backend.hermes.task_engine.create_task", unexpected_create_task)
    client = make_client(user_id="user-graph-read")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={
            "context": {
                "surface": "knowledge-graph",
                "route": "/knowledge-graph",
                "node_id": "radio",
                "node_label": "HNF Radio",
                "node_kind": "product",
                "canonical_route": "/music",
                "ui_session_id": "55555555-5555-4555-8555-555555555555",
            }
        },
    )
    token = parse_qs(urlparse(session_response.json()["assistant"]["server"]["url"]).query)["session"][0]
    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-graph-trace",
                "type": "tool-calls",
                "toolCallList": [{
                    "id": "call-graph-trace",
                    "name": "graph_action",
                    "parameters": {"action": "trace"},
                }],
            }
        },
    )
    assert response.status_code == 200
    result = json.loads(response.json()["results"][0]["result"])
    assert result["status"] == "accepted"
    assert result["action"] == "trace"
    assert result["node_id"] == "radio"
    assert result["governed_execution"] is False


def test_run_graph_action_creates_live_hermes_execution(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "task-graph-run", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    client = make_client(user_id="user-graph-run")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={
            "context": {
                "surface": "knowledge-graph",
                "route": "/knowledge-graph",
                "node_id": "films",
                "node_label": "AI Films",
                "node_kind": "product",
                "canonical_route": "/ai-films",
                "ui_session_id": "66666666-6666-4666-8666-666666666666",
            }
        },
    )
    token = parse_qs(urlparse(session_response.json()["assistant"]["server"]["url"]).query)["session"][0]
    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-graph-run",
                "type": "tool-calls",
                "toolCallList": [{
                    "id": "call-graph-run",
                    "name": "graph_action",
                    "parameters": {"action": "run"},
                }],
            }
        },
    )
    result = json.loads(response.json()["results"][0]["result"])
    assert result["status"] == "queued"
    assert result["action"] == "run"
    assert result["governed_execution"] is True
    assert captured["task_type"] == "voice.graph.run"
    assert captured["initial_status"] == "PENDING"
    assert captured["input_data"]["authenticated_user_id"] == "user-graph-run"
    assert str(UUID(result["correlation_id"])) == result["correlation_id"]


def test_connect_graph_action_is_paused_for_approval(monkeypatch):
    configure_signing(monkeypatch)
    captured: dict[str, object] = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "task-graph-connect", "title": kwargs["title"]}

    monkeypatch.setattr("backend.hermes.task_engine.create_task", fake_create_task)
    client = make_client(user_id="user-graph-connect")
    session_response = client.post(
        "/api/voice/session",
        headers={"host": "api.d3vonn.io", "x-forwarded-proto": "https"},
        json={
            "context": {
                "surface": "knowledge-graph",
                "route": "/knowledge-graph",
                "node_id": "films",
                "node_label": "AI Films",
                "node_kind": "product",
                "canonical_route": "/ai-films",
                "ui_session_id": "77777777-7777-4777-8777-777777777777",
            }
        },
    )
    token = parse_qs(urlparse(session_response.json()["assistant"]["server"]["url"]).query)["session"][0]
    response = client.post(
        f"/api/voice/vapi/webhook?session={token}",
        json={
            "message": {
                "id": "evt-graph-connect",
                "type": "tool-calls",
                "toolCallList": [{
                    "id": "call-graph-connect",
                    "name": "graph_action",
                    "parameters": {
                        "action": "connect",
                        "target_node_id": "knowledge",
                    },
                }],
            }
        },
    )
    result = json.loads(response.json()["results"][0]["result"])
    assert result["status"] == "approval_required"
    assert result["target_node_id"] == "knowledge"
    assert captured["task_type"] == "voice.graph.connect"
    assert captured["initial_status"] == "PAUSED"
