from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.hermes_event_stream import router
from backend.hermes.dependencies import HermesDependencies, configure_dependencies, reset_dependencies
from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryEventSink,
    InMemoryTaskRepository,
)


def make_client(repository: InMemoryTaskRepository, user_id: str = "user-live-1") -> TestClient:
    dependencies = HermesDependencies(
        repository=repository,
        dispatcher=InMemoryAgentDispatcher(),
        event_sink=InMemoryEventSink(),
        clock=FrozenClock(datetime(2026, 9, 26, tzinfo=timezone.utc)),
    )
    configure_dependencies(dependencies)
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    return TestClient(app)


def teardown_function():
    reset_dependencies()


def task(correlation_id: str, owner: str) -> dict:
    return {
        "id": "task-1",
        "correlation_id": correlation_id,
        "input_data": {"authenticated_user_id": owner},
        "created_at": "2026-09-26T22:00:00+00:00",
    }


def event(correlation_id: str) -> dict:
    return {
        "id": "event-1",
        "event": "task.created",
        "message": "Task created",
        "level": "info",
        "task_id": "task-1",
        "correlation_id": correlation_id,
        "created_at": "2026-09-26T22:00:01+00:00",
        "data": {
            "event": "task.created",
            "target_node_id": "hermes",
        },
    }


def test_stream_rejects_cross_user_execution():
    correlation_id = "corr-user-bound-123"
    repository = InMemoryTaskRepository(
        tables={"hermes_tasks": [task(correlation_id, "other-user")]}
    )
    response = make_client(repository, user_id="user-live-1").get(
        "/api/hermes/events/stream",
        params={"correlation_id": correlation_id},
    )
    assert response.status_code == 403


def test_stream_returns_404_for_unknown_execution():
    repository = InMemoryTaskRepository(tables={"hermes_tasks": []})
    response = make_client(repository).get(
        "/api/hermes/events/stream",
        params={"correlation_id": "corr-missing-123"},
    )
    assert response.status_code == 404


def test_authorized_stream_emits_public_event():
    correlation_id = "corr-live-12345"
    repository = InMemoryTaskRepository(
        tables={
            "hermes_tasks": [task(correlation_id, "user-live-1")],
            "hermes_logs": [event(correlation_id)],
        }
    )
    client = make_client(repository)

    with client.stream(
        "GET",
        "/api/hermes/events/stream",
        params={"correlation_id": correlation_id, "once": "true"},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        payload = None
        for line in response.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                break

    assert payload is not None
    assert payload["id"] == "event-1"
    assert payload["type"] == "task.created"
    assert payload["correlationId"] == correlation_id
    assert payload["data"]["target_node_id"] == "hermes"


def test_stream_fails_closed_when_repository_unconfigured():
    correlation_id = "corr-unconfigured-123"
    repository = InMemoryTaskRepository(
        configured=False,
        tables={"hermes_tasks": [task(correlation_id, "user-live-1")]},
    )
    response = make_client(repository).get(
        "/api/hermes/events/stream",
        params={"correlation_id": correlation_id},
    )
    assert response.status_code == 503
