from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryEventSink, InMemoryTaskRepository
from backend.hermes.workflows import (
    RetryPolicy,
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowStatus,
    WorkflowStepDefinition,
    WorkflowTaskReconciler,
    dispatch_idempotency_key,
)


def _definition(*, max_attempts: int = 1) -> WorkflowDefinition:
    return WorkflowDefinition(
        id="reconcile-flow",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(
                id="research",
                agent="TARS",
                retry=RetryPolicy(max_attempts=max_attempts),
            ),
        ),
    )


async def _bound_snapshot(task_id: str, *, definition: WorkflowDefinition | None = None):
    definition = definition or _definition()
    clock = FrozenClock(datetime(2026, 7, 18, 2, 30, tzinfo=timezone.utc))
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-1")
    snapshot = engine.mark_running(snapshot, "research", task_id=task_id)
    snapshot.steps["research"].status = StepStatus.WAITING
    return clock, snapshot


def test_dispatch_idempotency_key_is_stable_and_attempt_scoped() -> None:
    first = dispatch_idempotency_key(execution_id="exec-1", step_id="research", attempt=1)
    assert first == dispatch_idempotency_key(
        execution_id="exec-1", step_id="research", attempt=1
    )
    assert first != dispatch_idempotency_key(
        execution_id="exec-1", step_id="research", attempt=2
    )
    with pytest.raises(ValueError, match="attempt must be at least 1"):
        dispatch_idempotency_key(execution_id="exec-1", step_id="research", attempt=0)


@pytest.mark.asyncio
async def test_completed_task_resolves_waiting_step_without_redispatch() -> None:
    definition = _definition()
    clock, snapshot = await _bound_snapshot("task-1", definition=definition)
    repository = InMemoryTaskRepository(
        tables={
            "hermes_tasks": [
                {
                    "id": "task-1",
                    "status": "COMPLETED",
                    "output_data": {"answer": 42},
                    "completed_at": "2026-07-18T02:31:00+00:00",
                }
            ]
        }
    )
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=repository,
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.COMPLETED
    assert updated.steps["research"].status is StepStatus.COMPLETED
    assert updated.steps["research"].output == {"answer": 42}
    assert events.events[-1]["event"] == "workflow.step.reconciled.completed"


@pytest.mark.asyncio
async def test_active_task_remains_bound_and_waiting() -> None:
    definition = _definition()
    clock, snapshot = await _bound_snapshot("task-1", definition=definition)
    repository = InMemoryTaskRepository(
        tables={"hermes_tasks": [{"id": "task-1", "status": "RUNNING"}]}
    )
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=repository,
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.steps["research"].status is StepStatus.WAITING
    assert updated.steps["research"].task_id == "task-1"
    assert events.events[-1]["event"] == "workflow.step.reconciled.active"


@pytest.mark.asyncio
async def test_missing_task_releases_step_for_safe_redispatch() -> None:
    definition = _definition()
    clock, snapshot = await _bound_snapshot("missing-task", definition=definition)
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=InMemoryTaskRepository(),
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.steps["research"].status is StepStatus.READY
    assert updated.steps["research"].task_id is None
    assert "not found" in (updated.steps["research"].error or "")
    assert events.events[-1]["event"] == "workflow.step.released"


@pytest.mark.asyncio
async def test_failed_task_fails_workflow_when_retry_budget_exhausted() -> None:
    definition = _definition(max_attempts=1)
    clock, snapshot = await _bound_snapshot("task-1", definition=definition)
    repository = InMemoryTaskRepository(
        tables={
            "hermes_tasks": [
                {"id": "task-1", "status": "FAILED", "error_message": "agent error"}
            ]
        }
    )
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=repository,
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.FAILED
    assert updated.steps["research"].status is StepStatus.FAILED
    assert updated.steps["research"].error == "agent error"
    assert events.events[-1]["event"] == "workflow.step.reconciled.failed"


@pytest.mark.asyncio
async def test_failed_task_honors_retry_policy_and_releases_step() -> None:
    definition = _definition(max_attempts=3)
    clock, snapshot = await _bound_snapshot("task-1", definition=definition)
    repository = InMemoryTaskRepository(
        tables={
            "hermes_tasks": [
                {"id": "task-1", "status": "FAILED", "error_message": "transient agent error"}
            ]
        }
    )
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=repository,
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.RUNNING
    assert updated.steps["research"].status is StepStatus.READY
    assert updated.steps["research"].attempt == 1
    assert updated.steps["research"].task_id is None
    assert updated.steps["research"].error == "transient agent error"
    assert events.events[-1]["event"] == "workflow.step.reconciled.retry"


@pytest.mark.asyncio
async def test_retry_budget_exhausts_after_third_attempt() -> None:
    definition = _definition(max_attempts=3)
    clock, snapshot = await _bound_snapshot("task-3", definition=definition)
    snapshot.steps["research"].attempt = 3
    repository = InMemoryTaskRepository(
        tables={
            "hermes_tasks": [
                {"id": "task-3", "status": "FAILED", "error_message": "final agent error"}
            ]
        }
    )
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=repository,
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.FAILED
    assert updated.steps["research"].status is StepStatus.FAILED
    assert updated.steps["research"].attempt == 3
    assert updated.steps["research"].task_id == "task-3"
    assert events.events[-1]["event"] == "workflow.step.reconciled.failed"
