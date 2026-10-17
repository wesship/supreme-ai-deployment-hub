"""Fail-closed authorization tests for persistent Hermes SSE streams."""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.app.routers import hermes_event_stream as stream


class FakeRequest:
    async def is_disconnected(self):
        return False


@pytest.mark.asyncio
async def test_event_stream_closes_after_owner_revocation(monkeypatch):
    checks = 0
    async def authorize(correlation_id, user_id):
        nonlocal checks
        checks += 1
        if checks >= 3:
            raise HTTPException(status_code=403, detail="revoked")
        return {"input_data": {"authenticated_user_id": user_id}}

    class Repository:
        configured = True
        async def list_rows(self, table, params):
            assert table == "hermes_logs"
            return [{"id": str(checks), "correlation_id": "execution-123", "event": "task.progress", "created_at": "2026-10-16T12:00:00Z"}]

    monkeypatch.setattr(stream, "_authorized_correlation", authorize)
    monkeypatch.setattr(stream, "get_dependencies", lambda: SimpleNamespace(repository=Repository()))
    response = await stream.stream_hermes_events(FakeRequest(), correlation_id="execution-123", once=False, user_id="account-a")
    events = [event async for event in response.body_iterator]
    assert len(events) == 1
    assert checks == 3


@pytest.mark.asyncio
async def test_stream_filters_mismatched_rows_from_privileged_repository(monkeypatch):
    async def authorize(correlation_id, user_id):
        return {"input_data": {"authenticated_user_id": user_id}}

    class Repository:
        configured = True
        async def list_rows(self, table, params):
            return [
                {"id": "wrong", "correlation_id": "different-execution", "event": "secret", "message": "private"},
                {"id": "right", "correlation_id": "execution-123", "event": "task.progress", "message": "owned"},
            ]

    monkeypatch.setattr(stream, "_authorized_correlation", authorize)
    monkeypatch.setattr(stream, "get_dependencies", lambda: SimpleNamespace(repository=Repository()))
    response = await stream.stream_hermes_events(FakeRequest(), correlation_id="execution-123", once=True, user_id="account-a")
    events = [event async for event in response.body_iterator]
    assert len(events) == 1
    assert events[0]["id"] == "right"
    assert json.loads(events[0]["data"])["message"] == "owned"
