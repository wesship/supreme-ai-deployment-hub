"""Regression tests for user-safe OpenAI provider errors."""
from backend.app.routers.chat import (
    _QUOTA_MESSAGE,
    _RATE_LIMIT_MESSAGE,
    _provider_error_message,
)


def test_insufficient_quota_is_classified_without_leaking_provider_body():
    body = """{"error":{"message":"You have no credits remaining. Add credits at https://platform.openai.com/settings/organization/billing","type":"insufficient_quota","code":"insufficient_quota"}}"""

    message = _provider_error_message(429, body)

    assert message == _QUOTA_MESSAGE
    assert "platform.openai.com" not in message
    assert "insufficient_quota" not in message


def test_temporary_429_remains_a_rate_limit_message():
    body = """{"error":{"message":"Rate limit reached for requests","type":"rate_limit_exceeded","code":"rate_limit_exceeded"}}"""

    assert _provider_error_message(429, body) == _RATE_LIMIT_MESSAGE


def test_malformed_provider_error_is_not_reflected_to_user():
    provider_body = "<html>upstream proxy failure with internal details</html>"

    message = _provider_error_message(502, provider_body)

    assert message == "D3VONN AI provider request failed (HTTP 502). Please try again."
    assert provider_body not in message
