"""Regression tests: privileged Hermes rows must match authenticated voice identity."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4
import pytest

from backend.app.routers import voice_orchestration as voice


@pytest.mark.asyncio
@pytest.mark.parametrize("row_owner,row_session,expected", [
    ("account-a", "correct", True),
    ("account-b", "correct", False),
    ("account-a", "different", False),
    (None, "correct", False),
])
async def test_latest_voice_execution_enforces_ownership_even_if_privileged_query_returns_row(
    monkeypatch, row_owner, row_session, expected
):
    session = str(uuid4())
    returned_session = session if row_session == "correct" else str(uuid4())
    row = {
        "id": "task-1",
        "correlation_id": "correlation-1",
        "created_at": "2026-10-16T12:00:00Z",
        "input_data": {
            "authenticated_user_id": row_owner,
            "voice_context": {"ui_session_id": returned_session},
        },
    }

    class Repository:
        configured = True
        async def list_rows(self, table, params):
            assert table == "hermes_tasks"
            assert params["input_data->>authenticated_user_id"] == "eq.account-a"
            return [row]

    monkeypatch.setattr(voice, "get_dependencies", lambda: SimpleNamespace(repository=Repository()))
    result = await voice.latest_voice_execution(ui_session_id=session, user_id="account-a")
    assert (result["execution"] is not None) is expected


@pytest.mark.asyncio
async def test_latest_voice_execution_rejects_missing_ownership_metadata(monkeypatch):
    session = str(uuid4())

    class Repository:
        configured = True
        async def list_rows(self, table, params):
            return [{"id": "task-1", "correlation_id": "c-1", "input_data": None}]

    monkeypatch.setattr(voice, "get_dependencies", lambda: SimpleNamespace(repository=Repository()))
    assert await voice.latest_voice_execution(ui_session_id=session, user_id="account-a") == {"execution": None}
