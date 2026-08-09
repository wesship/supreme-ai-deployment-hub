"""Regression tests for Railway-native Vapi activation payloads."""

from __future__ import annotations

import httpx

from backend.app.voice_activation import _normalized_server_messages, _safe_error


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
