"""Fail-closed regression tests for unscoped voice film retrieval."""
from __future__ import annotations

import json
import pytest

from backend.app.routers import voice_orchestration as voice


@pytest.mark.asyncio
async def test_authenticated_film_voice_tool_never_queries_shared_store(monkeypatch):
    async def forbidden(_params):
        raise AssertionError("Unscoped provider must not be invoked")
    monkeypatch.setattr(voice, "_query_film_intelligence", forbidden)
    message = {"toolCallList": [
        {"id": "call-1", "name": "query_film_intelligence", "parameters": {"query": "private footage"}}
    ]}
    for user_id in ("account-a", "account-b"):
        response = await voice._handle_tool_calls(message, "event-1", user_id)
        assert len(response["results"]) == 1
        result = json.loads(response["results"][0]["result"])
        assert result["status"] == "unavailable"
        assert "owner-scoped" in result["message"]


@pytest.mark.asyncio
async def test_missing_identity_rejects_voice_film_tool(monkeypatch):
    async def forbidden(_params):
        raise AssertionError("Unscoped provider must not be invoked")
    monkeypatch.setattr(voice, "_query_film_intelligence", forbidden)
    message = {"toolCallList": [
        {"id": "call-2", "name": "query_film_intelligence", "parameters": {"query": "anything"}}
    ]}
    response = await voice._handle_tool_calls(message, "event-2", None)
    assert json.loads(response["results"][0]["result"])["status"] == "rejected"


@pytest.mark.asyncio
async def test_voice_health_does_not_claim_user_film_access_ready():
    health = await voice.voice_health()
    assert health["film_intelligence_ready"] is False
