from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import (
    FrozenClock,
    InMemoryCheckpointStore,
    InMemoryEventSink,
    InMemoryTaskRepository,
)
from backend.hermes.workflows import (
    RetryPolicy,
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowLifecycleService,
    WorkflowRecoveryService,
    WorkflowRetryService,
    WorkflowStatus,
    WorkflowStepDefinition,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    clock = FrozenClock(datetime(2026, 7, 18, 9, 0, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    checkpoints = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    recovery = WorkflowRecoveryService(store=checkpoints, clock=clock, event_sink=events)
    retries = WorkflowRetryService(recovery=recovery, clock=clock, event_sink=events)
    lifecycle = WorkflowLifecycleService(
        repository=repository,
        recovery=recovery,
        retry_service=retries,
        clock=clock,
        event_sink=events,
    )
    return lifecycle, repository, checkpoints, events, clock


def definition() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="lifecycle-flow",
        version="1.0.0",
        timeout_seconds=600,
        steps=(
            WorkflowStepDefinition(
                id="active",
                agent="TARS",
                timeout_seconds=30,
                retry=RetryPolicy(max_attempts=2, backoff_seconds=10, retryable_errors=("timeout",)),
            ),
            WorkflowStepDefinition(id="downstream", agent="ION", depends_on=("active",)),
        ),
    )


def test_initialize_deadlines_is_deterministic() -> None:
    lifecycle, _, _, _, clock = build_runtime()
    defn = definition()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-deadlines")
    snapshot = engine.mark_running(snapshot, "active", task_id="task-1")

    initialized = lifecycle.initialize_deadlines(defn, snapshot)

    assert initialized.deadline_at == (clock.current + timedelta(seconds=600)).isoformat()
    assert initialized.steps["active"].deadline_at == (
        clock.current + timedelta(seconds=30)
    ).isoformat()


def test_cancellation_propagates_to_bound_tasks_and_is_idempotent() -> None:
    lifecycle, repository, checkpoints, events, clock = build_runtime()
    defn = definition()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-cancel")
    snapshot = engine.mark_running(snapshot, "active", task_id="task-1")
    repository.tables["hermes_tasks"] = [
        {"id": "task-1", "status": "RUNNING", "agent_name": "TARS"}
    ]

    cancelled = run(
        lifecycle.cancel(
            defn,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
            actor_id="operator-1",
            reason="operator requested shutdown",
        )
    )
    repeated = run(
        lifecycle.cancel(
            defn,
            cancelled,
            user_id="user-1",
            goal_id="goal-1",
            actor_id="operator-1",
            reason="operator requested shutdown",
        )
    )

    assert cancelled.status is WorkflowStatus.CANCELLED
    assert cancelled.steps["active"].status is StepStatus.CANCELLED
    assert cancelled.steps["downstream"].status is StepStatus.CANCELLED
    assert repository.tables["hermes_tasks"][0]["status"] == "CANCELLED"
    assert len(checkpoints.records) == 1
    assert repeated.checkpoint_sequence == cancelled.checkpoint_sequence
    assert any(event["event"] == "workflow.cancelled" for event in events.events)


def test_completed_workflow_cannot_be_cancelled() -> None:
    lifecycle, _, _, _, clock = build_runtime()
    defn = definition()
    snapshot = WorkflowEngine(clock).create_execution(defn, execution_id="exec-complete")
    snapshot.status = WorkflowStatus.COMPLETED

    with pytest.raises(ValueError, match="completed workflows"):
        run(
            lifecycle.cancel(
                defn,
                snapshot,
                user_id="user-1",
                goal_id="goal-1",
                actor_id="operator-1",
                reason="too late",
            )
        )


def test_step_timeout_routes_through_retry_engine() -> None:
    lifecycle, repository, checkpoints, events, clock = build_runtime()
    defn = definition()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-timeout")
    snapshot = engine.mark_running(snapshot, "active", task_id="task-timeout")
    repository.tables["hermes_tasks"] = [
        {"id": "task-timeout", "status": "RUNNING", "agent_name": "TARS"}
    ]
    snapshot = lifecycle.initialize_deadlines(defn, snapshot)
    clock.current = clock.current + timedelta(seconds=31)

    updated = run(
        lifecycle.enforce_timeouts(
            defn,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    state = updated.steps["active"]
    assert repository.tables["hermes_tasks"][0]["status"] == "FAILED"
    assert state.status is StepStatus.WAITING
    assert state.error_type == "timeout"
    assert state.next_retry_at == (clock.current + timedelta(seconds=10)).isoformat()
    assert len(checkpoints.records) == 1
    assert any(event["event"] == "workflow.step.timed_out" for event in events.events)
    assert any(event["event"] == "workflow.step.retry.scheduled" for event in events.events)


def test_workflow_deadline_cancels_all_remaining_work() -> None:
    lifecycle, repository, _, events, clock = build_runtime()
    defn = definition()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-workflow-timeout")
    snapshot = engine.mark_running(snapshot, "active", task_id="task-1")
    repository.tables["hermes_tasks"] = [{"id": "task-1", "status": "RUNNING"}]
    snapshot = lifecycle.initialize_deadlines(defn, snapshot)
    clock.current = clock.current + timedelta(seconds=601)

    cancelled = run(
        lifecycle.enforce_timeouts(
            defn,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert cancelled.status is WorkflowStatus.CANCELLED
    assert cancelled.metadata["cancellation"]["reason"] == "workflow deadline exceeded"
    assert any(event["event"] == "workflow.deadline.exceeded" for event in events.events)


def test_occ_projection_exposes_deadlines_and_cancellation() -> None:
    lifecycle, _, _, _, clock = build_runtime()
    defn = definition()
    snapshot = WorkflowEngine(clock).create_execution(defn, execution_id="exec-occ")
    snapshot = lifecycle.initialize_deadlines(defn, snapshot)
    projection = lifecycle.occ_projection(snapshot)

    assert projection["workflow_deadline_at"] == snapshot.deadline_at
    assert projection["cancelled"] is False
    assert projection["timed_out_steps"] == []
