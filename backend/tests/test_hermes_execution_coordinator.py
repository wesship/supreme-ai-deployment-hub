from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryCheckpointStore,
    InMemoryEventSink,
    InMemoryTaskRepository,
)
from backend.hermes.workflows import (
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowExecutionCoordinator,
    WorkflowRecoveryService,
    WorkflowStepDefinition,
    dispatch_idempotency_key,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime(*, dispatcher=None):
    clock = FrozenClock(datetime(2026, 7, 18, 3, 0, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    checkpoint_store = InMemoryCheckpointStore()
    event_sink = InMemoryEventSink()
    agent_dispatcher = dispatcher or InMemoryAgentDispatcher()
    recovery = WorkflowRecoveryService(
        store=checkpoint_store,
        clock=clock,
        event_sink=event_sink,
    )
    coordinator = WorkflowExecutionCoordinator(
        repository=repository,
        dispatcher=agent_dispatcher,
        recovery=recovery,
        clock=clock,
        event_sink=event_sink,
    )
    return coordinator, repository, checkpoint_store, agent_dispatcher, event_sink, clock


def definition(*steps: WorkflowStepDefinition) -> WorkflowDefinition:
    return WorkflowDefinition(id="launch", version="1.0.0", steps=steps)


def test_ready_step_is_bound_checkpointed_and_dispatched_once() -> None:
    coordinator, repository, checkpoints, dispatcher, events, clock = build_runtime()
    workflow = definition(
        WorkflowStepDefinition(id="plan", agent="TARS", input={"goal": "launch"})
    )
    snapshot = WorkflowEngine(clock).create_execution(workflow, execution_id="exec-1")

    updated = run(
        coordinator.dispatch_ready(
            workflow,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    state = updated.steps["plan"]
    task = repository.tables["hermes_tasks"][0]
    expected_key = dispatch_idempotency_key(
        execution_id="exec-1",
        step_id="plan",
        attempt=1,
    )

    assert state.status is StepStatus.WAITING
    assert state.attempt == 1
    assert state.task_id == task["id"]
    assert task["status"] == TaskStatus.LOCKED.value
    assert task["correlation_id"] == expected_key
    assert dispatcher.calls[0]["idempotency_key"] == expected_key
    assert dispatcher.calls[0]["input"]["_hermes"]["idempotency_key"] == expected_key
    assert len(checkpoints.records) == 2
    assert [event["event"] for event in events.events].count("workflow.step.dispatched") == 1


def test_stale_ready_snapshot_reuses_task_without_duplicate_dispatch() -> None:
    coordinator, repository, _, dispatcher, _, clock = build_runtime()
    workflow = definition(WorkflowStepDefinition(id="plan", agent="TARS"))
    stale = WorkflowEngine(clock).create_execution(workflow, execution_id="exec-2")

    first = run(
        coordinator.dispatch_ready(
            workflow,
            stale,
            user_id="user-1",
            goal_id="goal-2",
        )
    )
    second = run(
        coordinator.dispatch_ready(
            workflow,
            stale,
            user_id="user-1",
            goal_id="goal-2",
        )
    )

    assert first.steps["plan"].task_id == second.steps["plan"].task_id
    assert len(repository.tables["hermes_tasks"]) == 1
    assert len(dispatcher.calls) == 1


def test_parallel_ready_steps_follow_definition_order_and_limit() -> None:
    coordinator, repository, _, dispatcher, _, clock = build_runtime()
    workflow = definition(
        WorkflowStepDefinition(id="first", agent="TARS"),
        WorkflowStepDefinition(id="second", agent="ION"),
    )
    snapshot = WorkflowEngine(clock).create_execution(workflow, execution_id="exec-3")

    updated = run(
        coordinator.dispatch_ready(
            workflow,
            snapshot,
            user_id="user-1",
            goal_id="goal-3",
            max_steps=1,
        )
    )

    assert [row["title"] for row in repository.tables["hermes_tasks"]] == ["launch:first"]
    assert dispatcher.calls[0]["agent"] == "TARS"
    assert updated.steps["first"].status is StepStatus.WAITING
    assert updated.steps["second"].status is StepStatus.READY


class FailingDispatcher:
    configured = True

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        raise RuntimeError("edge unavailable")


def test_dispatch_failure_persists_failed_task_for_reconciliation() -> None:
    coordinator, repository, checkpoints, _, events, clock = build_runtime(
        dispatcher=FailingDispatcher()
    )
    workflow = definition(WorkflowStepDefinition(id="plan", agent="TARS"))
    snapshot = WorkflowEngine(clock).create_execution(workflow, execution_id="exec-4")

    updated = run(
        coordinator.dispatch_ready(
            workflow,
            snapshot,
            user_id="user-1",
            goal_id="goal-4",
        )
    )

    task = repository.tables["hermes_tasks"][0]
    assert task["status"] == TaskStatus.FAILED.value
    assert task["error_message"] == "dispatch failed: edge unavailable"
    assert updated.steps["plan"].status is StepStatus.WAITING
    assert updated.steps["plan"].error == "dispatch failed: edge unavailable"
    assert len(checkpoints.records) == 2
    assert events.events[-1]["event"] == "workflow.step.dispatch.failed"
