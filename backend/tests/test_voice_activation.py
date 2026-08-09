"""Regression tests for Railway-native Vapi activation payloads."""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from backend.app.voice_activation import (
    _inspect_direct_elevenlabs_key,
    _normalized_server_messages,
    _safe_error,
)


def test_server_messages_remove_retired_assistant_request() -> None:
    messages = _normalized_server_messages(
        [
            "assistant-request",
            "status-update",
            "tool-calls",
            "custom-observability-event",
        ]
    )

    assert "assistant-request" not in messages
    assert "custom-observability-event" not in messages
    assert {
        "tool-calls",
        "status-update",
        "end-of-call-report",
        "transcript",
    }.issubset(messages)
    assert messages == sorted(set(messages))


def test_provider_validation_detail_is_safe_and_actionable() -> None:
    request = httpx.Request("PATCH", "https://api.vapi.ai/assistant/test")
    response = httpx.Response(
        400,
        request=request,
        json={
            "message": ["assistant-request is not supported"],
            "echo": "production-secret",
        },
    )
    error = httpx.HTTPStatusError(
        "Bad Request",
        request=request,
        response=response,
    )

    rendered = _safe_error(error, ("production-secret",))

    assert "assistant-request is not supported" in rendered
    assert "production-secret" not in rendered


@pytest.mark.asyncio
async def test_direct_elevenlabs_probe_is_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("D3VONN_VALIDATE_DIRECT_ELEVENLABS", raising=False)
    client = AsyncMock()

    status, voice_name = await _inspect_direct_elevenlabs_key(
        client,
        "sk_restricted-production-key",
        "21m00Tcm4TlvDq8ikWAM",
        "voice-test",
    )

    assert status == "validation_disabled"
    assert voice_name is None
    client.get.assert_not_awaited()
