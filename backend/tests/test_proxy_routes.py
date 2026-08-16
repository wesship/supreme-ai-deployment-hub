"""
Devonn.ai Backend Proxy — Tests
Covers all proxy routes: /api/chat, /api/rag/*, /api/tools/*.
Uses httpx.AsyncClient with FastAPI's ASGI transport (no real network calls).
External API calls are mocked with unittest.mock.patch.
"""
import inspect
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.params import Depends as DependsParam
from fastapi.testclient import TestClient

# ── App import ────────────────────────────────────────────────────────────────
# Import the FastAPI app. We patch settings to disable auth and inject test keys.
import os
import sys

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.app.config import Settings, get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.routers import proxy_router

# Build a minimal test app with only the proxy router
test_app = FastAPI()
test_app.include_router(proxy_router)


# ── Test settings fixture ─────────────────────────────────────────────────────
def _test_settings() -> Settings:
    return Settings(
        openai_api_key="sk-test-openai",
        elevenlabs_api_key="el-test",
        assemblyai_api_key="aai-test",
        github_token="ghp-test",
        n8n_api_key="n8n-test",
        n8n_base_url="https://n8n.test.local",
        pinecone_api_key="pcsk-test",
        pinecone_host="test-index.svc.pinecone.io",
        pinecone_index_name="document-store",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="service-role-test",
        require_auth=False,
        app_env="test",
    )


async def _mock_user_id() -> str:
    return "test-user-id"


@pytest.fixture(autouse=True)
def override_settings():
    get_settings.cache_clear()
    test_app.dependency_overrides[get_settings] = _test_settings
    test_app.dependency_overrides[get_current_user_id] = _mock_user_id

    ts = _test_settings()
    patches = [
        patch("backend.app.routers.chat.get_settings", return_value=ts),
        patch("backend.app.routers.rag.get_settings", return_value=ts),
        patch("backend.app.routers.tools.get_settings", return_value=ts),
    ]
    for item in patches:
        item.start()

    yield

    for item in patches:
        item.stop()
    test_app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
def client():
    return TestClient(test_app)


class TestChatProxy:
    def test_chat_non_streaming_success(self, client):
        mock_response = {
            "choices": [{"message": {"content": "Hello from Devonn!", "role": "assistant"}}],
            "model": "gpt-4.1-mini",
        }
        with patch("backend.app.routers.chat.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_response
            mock_client.post = AsyncMock(return_value=mock_resp)
            resp = client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hello"}], "stream": False, "model": "gpt-4.1-mini"},
            )
        assert resp.status_code == 200
        assert resp.json()["choices"][0]["message"]["content"] == "Hello from Devonn!"

    def test_chat_invalid_model_rejected(self, client):
        resp = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "Hi"}], "model": "gpt-3.5-turbo", "stream": False},
        )
        assert resp.status_code == 422

    def test_chat_empty_messages_rejected(self, client):
        resp = client.post("/api/chat", json={"messages": [], "stream": False})
        assert resp.status_code == 422

    def test_chat_missing_openai_key_returns_503(self, client):
        no_key = _test_settings()
        no_key.openai_api_key = ""
        with patch("backend.app.routers.chat.get_settings", return_value=no_key):
            resp = client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hi"}], "stream": False},
            )
        assert resp.status_code == 503


class TestRAGProxy:
    def _sample_ingest_payload(self):
        return {
            "filename": "test.txt",
            "chunks": [{
                "id": "test_chunk_0",
                "text": "This is a test document about Devonn.ai.",
                "metadata": {
                    "source": "test.txt",
                    "filename": "test.txt",
                    "chunkIndex": 0,
                    "totalChunks": 1,
                    "uploadedAt": "2026-05-25T00:00:00Z",
                },
            }],
        }

    def test_rag_ingest_success(self, client):
        with patch("backend.app.routers.rag._embed_texts", new_callable=AsyncMock) as mock_embed, \
             patch("backend.app.routers.rag._pinecone_upsert", new_callable=AsyncMock) as mock_upsert:
            mock_embed.return_value = [[0.1] * 768]
            mock_upsert.return_value = None
            resp = client.post("/api/rag/ingest", json=self._sample_ingest_payload())
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["chunksIngested"] == 1
        assert resp.json()["filename"] == "test.txt"

    def test_rag_ingest_empty_chunks_rejected(self, client):
        assert client.post("/api/rag/ingest", json={"filename": "test.txt", "chunks": []}).status_code == 422

    def test_rag_retrieve_success(self, client):
        with patch("backend.app.routers.rag._embed_texts", new_callable=AsyncMock) as mock_embed, \
             patch("backend.app.routers.rag._pinecone_query", new_callable=AsyncMock) as mock_query:
            mock_embed.return_value = [[0.1] * 768]
            mock_query.return_value = [{"metadata": {"text": "Devonn.ai is an AI platform.", "source": "test.txt"}, "score": 0.92}]
            resp = client.post("/api/rag/retrieve", json={"query": "What is Devonn.ai?", "topK": 3})
        assert resp.status_code == 200
        assert len(resp.json()["results"]) == 1
        assert resp.json()["results"][0]["score"] == 0.92

    def test_rag_delete_success(self, client):
        with patch("backend.app.routers.rag.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_client.post = AsyncMock(return_value=mock_resp)
            resp = client.post("/api/rag/delete", json={"filename": "test.txt"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestToolsProxy:
    def test_tts_success(self, client):
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = b"fake-audio-bytes"
            mock_client.post = AsyncMock(return_value=mock_resp)
            resp = client.post("/api/tools/voice/tts", json={"text": "Hello Devonn."})
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "audio/mpeg"
        assert resp.content == b"fake-audio-bytes"

    def test_tts_missing_key_returns_503(self, client):
        no_key = _test_settings()
        no_key.elevenlabs_api_key = ""
        no_key.openai_api_key = ""
        with patch("backend.app.routers.tools.get_settings", return_value=no_key):
            resp = client.post("/api/tools/voice/tts", json={"text": "Hello."})
        assert resp.status_code == 503

    def test_stt_token_success(self, client):
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"token": "aai-temp-token-xyz"}
            mock_client.get = AsyncMock(return_value=mock_resp)

            resp = client.post("/api/tools/voice/stt-token", json={"expires_in": 480})

        assert resp.status_code == 200
        assert resp.json()["token"] == "aai-temp-token-xyz"
        mock_client.get.assert_awaited_once_with(
            "https://streaming.assemblyai.com/v3/token",
            params={
                "expires_in_seconds": 480,
                "max_session_duration_seconds": 3600,
            },
            headers={"Authorization": "aai-test"},
        )

    def test_github_trigger_success(self, client):
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 204
            mock_client.post = AsyncMock(return_value=mock_resp)
            resp = client.post(
                "/api/tools/github/workflows/trigger",
                json={"workflow": "deploy.yml", "branch": "main"},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert "deploy.yml" in resp.json()["message"]

    def test_github_runs_status_success(self, client):
        mock_runs_data = {
            "total_count": 1,
            "workflow_runs": [{
                "name": "Deploy",
                "status": "completed",
                "conclusion": "success",
                "created_at": "2026-05-25T00:00:00Z",
                "html_url": "https://github.com/wesship/supreme-ai-deployment-hub/actions/runs/1",
            }],
        }
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_runs_data
            mock_client.get = AsyncMock(return_value=mock_resp)
            resp = client.get("/api/tools/github/runs/status")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["runs"][0]["name"] == "Deploy"

    def test_n8n_execute_workflow_not_found(self, client):
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"data": []}
            mock_client.get = AsyncMock(return_value=mock_resp)
            resp = client.post(
                "/api/tools/n8n/execute",
                json={"workflow_name": "NonExistentWorkflow", "payload": {}},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "not found" in resp.json()["error"]

    def test_n8n_execute_success(self, client):
        with patch("backend.app.routers.tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            list_resp = MagicMock()
            list_resp.status_code = 200
            list_resp.json.return_value = {"data": [{"id": "wf-123", "name": "TestWorkflow"}]}
            exec_resp = MagicMock()
            exec_resp.status_code = 200
            exec_resp.json.return_value = {"executionId": "exec-456"}
            mock_client.get = AsyncMock(return_value=list_resp)
            mock_client.post = AsyncMock(return_value=exec_resp)
            resp = client.post(
                "/api/tools/n8n/execute",
                json={"workflow_name": "TestWorkflow", "payload": {"key": "value"}},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["result"]["executionId"] == "exec-456"


class TestAuthEnforcement:
    def test_auth_dependency_is_present_on_tools_routes(self):
        route_paths = {
            route.path: route
            for route in test_app.routes
            if hasattr(route, "path") and hasattr(route, "endpoint")
        }
        for path in [
            "/api/tools/voice/tts",
            "/api/tools/voice/stt-token",
            "/api/tools/github/workflows/trigger",
            "/api/tools/github/runs/status",
            "/api/tools/n8n/execute",
        ]:
            route = route_paths[path]
            dependency_calls = [
                parameter.default.dependency
                for parameter in inspect.signature(route.endpoint).parameters.values()
                if isinstance(parameter.default, DependsParam)
            ]
            assert get_current_user_id in dependency_calls
