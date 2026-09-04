"""Tests for Hermes ports, adapters, and dependency injection."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from backend.hermes.adapters import RepositoryEventSink
from backend.hermes.dependencies import HermesDependencies
from backend.hermes.ports import AgentDispatcher, Clock, EventSink, TaskRepository
from backend.hermes.task_engine import (
    TaskTransitionConflict,
    configure_runtime,
    create_task,
    dispatch_to_agent,
    reset_runtime,
    transition_task,
)
from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryEventSink,
    InMemoryTaskRepository,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    repository = InMemoryTaskRepository()
    dispatcher = InMemoryAgentDispatcher()
    event_sink = InMemoryEventSink()
    clock = FrozenClock(datetime(2026, 7, 18, 1, 2, 3, tzinfo=timezone.utc))
    dependencies = HermesDependencies(
        repository=repository,
        dispatcher=dispatcher,
        event_sink=event_sink,
        clock=clock,
    )
    return dependencies, repository, dispatcher, event_sink, clock


def test_in_memory_adapters_satisfy_ports():
    dependencies, *_ = build_runtime()
    assert isinstance(dependencies.repository, TaskRepository)
    assert isinstance(dependencies.dispatcher, AgentDispatcher)
    assert isinstance(dependencies.event_sink, EventSink)
    assert isinstance(dependencies.clock, Clock)


def test_task_lifecycle_uses_injected_repository_clock_and_event_sink():
    dependencies, repository, _, event_sink, clock = build_runtime()
    configure_runtime(dependencies)
    try:
        task = run(create_task("Port-backed task", correlation_id="corr-1"))
        task = run(
            transition_task(
                task["id"],
                "LOCKED",
                agent_name="TARS",
                expected_status="PENDING",
            )
        )
        updated = run(transition_task(task["id"], "RUNNING", agent_name="TARS"))

        assert updated["status"] == "RUNNING"
        assert updated["started_at"] == clock.current.isoformat()
        assert updated["assigned_at"] == clock.current.isoformat()
        assert repository.tables["hermes_tasks"][0]["agent_name"] == "TARS"
        assert [event["event"] for event in event_sink.events] == [
            "task.created",
            "task.locked",
            "task.running",
        ]
        assert event_sink.events[0]["correlation_id"] == "corr-1"
    finally:
        reset_runtime()


def test_dispatch_uses_injected_dispatcher_and_canonical_agent_name():
    dependencies, _, dispatcher, _, _ = build_runtime()
    configure_runtime(dependencies)
    try:
        result = run(dispatch_to_agent("tars", "task-7", {"query": "status"}))
        assert result["status"] == "queued"
        assert dispatcher.calls == [
            {"task_id": "task-7", "agent": "TARS", "input": {"query": "status"}}
        ]
    finally:
        reset_runtime()


def test_unconfigured_dispatcher_preserves_graceful_skip():
    dependencies, repository, dispatcher, event_sink, clock = build_runtime()
    dispatcher.configured = False
    configure_runtime(
        HermesDependencies(
            repository=repository,
            dispatcher=dispatcher,
            event_sink=event_sink,
            clock=clock,
        )
    )
    try:
        assert run(dispatch_to_agent("ION", "task-8")) == {
            "status": "skipped",
            "reason": "not_configured",
        }
    finally:
        reset_runtime()


def test_expected_status_transition_allows_only_one_claim():
    dependencies, _, _, event_sink, _ = build_runtime()
    configure_runtime(dependencies)
    try:
        task = run(create_task("Contended task"))
        claimed = run(
            transition_task(
                task["id"],
                "LOCKED",
                agent_name="TARS",
                expected_status="PENDING",
            )
        )

        assert claimed["status"] == "LOCKED"
        try:
            run(
                transition_task(
                    task["id"],
                    "LOCKED",
                    agent_name="ION",
                    expected_status="PENDING",
                )
            )
        except TaskTransitionConflict:
            pass
        else:
            raise AssertionError("a second worker claimed an already locked task")

        assert [event["event"] for event in event_sink.events].count("task.locked") == 1
    finally:
        reset_runtime()


def test_repository_event_sink_normalizes_rich_events_for_fixed_log_schema():
    class CaptureRepository:
        def __init__(self):
            self.calls = []

        async def create_row(self, table, payload):
            self.calls.append((table, payload))
            return payload

    repository = CaptureRepository()
    sink = RepositoryEventSink(repository)  # type: ignore[arg-type]
    event = {
        "event": "model_council.shadow.started",
        "execution_id": "staging-shadow-smoke",
        "workflow_id": "staging-shadow-smoke",
        "step_id": "synthetic-step",
        "agent_name": "TARS",
        "candidate_count": 2,
        "task_id": "not-a-uuid",
    }

    run(sink.emit(event))

    table, payload = repository.calls[0]
    assert table == "hermes_logs"
    assert payload["event"] == "model_council.shadow.started"
    assert payload["message"] == "model_council.shadow.started"
    assert payload["level"] == "info"
    assert payload["agent_name"] == "TARS"
    assert payload["data"] == event
    assert "execution_id" not in payload
    assert "workflow_id" not in payload
    assert "step_id" not in payload
    assert "candidate_count" not in payload
    assert "task_id" not in payload


def test_repository_event_sink_promotes_valid_uuid_columns():
    class CaptureRepository:
        def __init__(self):
            self.calls = []

        async def create_row(self, table, payload):
            self.calls.append((table, payload))
            return payload

    repository = CaptureRepository()
    sink = RepositoryEventSink(repository)  # type: ignore[arg-type]
    task_id = "123e4567-e89b-12d3-a456-426614174000"
    correlation_id = "123e4567-e89b-12d3-a456-426614174001"

    run(
        sink.emit(
            {
                "event": "task.completed",
                "task_id": task_id,
                "correlation_id": correlation_id,
                "agent": "ION",
            }
        )
    )

    _, payload = repository.calls[0]
    assert payload["task_id"] == task_id
    assert payload["correlation_id"] == correlation_id
    assert payload["agent_name"] == "ION"