"""Regression coverage for dependency-aware API readiness."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend import main


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status_code", "expected"),
    [(200, "reachable"), (204, "reachable"), (302, "unreachable"), (503, "unreachable")],
)
async def test_supabase_readiness_requires_success_response(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
    expected: str,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    response = MagicMock(spec=httpx.Response)
    response.is_success = 200 <= status_code < 300

    with patch("backend.main.httpx.AsyncClient") as client_class:
        client = AsyncMock()
        client_class.return_value.__aenter__.return_value = client
        client.get.return_value = response

        assert await main._supabase_status() == expected

    client_class.assert_called_once_with(timeout=3.0, follow_redirects=True)
    client.get.assert_awaited_once_with(
        "https://example.supabase.co/rest/v1/",
        headers={
            "apikey": "test-service-role-key",
            "Authorization": "Bearer test-service-role-key",
        },
    )


@pytest.mark.asyncio
async def test_supabase_readiness_fails_closed_on_network_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

    with patch("backend.main.httpx.AsyncClient") as client_class:
        client = AsyncMock()
        client_class.return_value.__aenter__.return_value = client
        client.get.side_effect = httpx.ConnectError("connection refused")

        assert await main._supabase_status() == "unreachable"


@pytest.mark.asyncio
async def test_supabase_readiness_reports_missing_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    assert await main._supabase_status() == "not_configured"
