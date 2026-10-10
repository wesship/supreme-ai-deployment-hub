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
)


def _definition(*, max_attempts: int) -> WorkflowDefinition:
    return WorkflowDefinition(
        id="retry-reconcile-flow",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(
                id="research",
                agent="TARS",
                retry=RetryPolicy(max_attempts=max_attempts),
            ),
        ),
    )


def _waiting_snapshot(definition: WorkflowDefinition, task_id: str, *, attempt: int = 1):
    clock = FrozenClock(datetime(2026, 9, 3, 23, 20, tzinfo=timezone.utc))
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-retry")
    snapshot = engine.mark_running(snapshot, "research", task_id=task_id)
    snapshot.steps["research"].status = StepStatus.WAITING
    snapshot.steps["research"].attempt = attempt
    return clock, snapshot


@pytest.mark.asyncio
async def test_failed_bound_task_releases_step_when_retry_budget_remains() -> None:
    definition = _definition(max_attempts=3)
    clock, snapshot = _waiting_snapshot(definition, "task-1")
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=InMemoryTaskRepository(
            tables={
                "hermes_tasks": [
                    {"id": "task-1", "status": "FAILED", "error_message": "transient agent error"}
                ]
            }
        ),
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.RUNNING
    assert updated.steps["research"].status is StepStatus.READY
    assert updated.steps["research"].task_id is None
    assert updated.steps["research"].error == "transient agent error"
    assert events.events[-1]["event"] == "workflow.step.reconciled.retry"


@pytest.mark.asyncio
async def test_failed_bound_task_is_terminal_when_retry_budget_exhausted() -> None:
    definition = _definition(max_attempts=3)
    clock, snapshot = _waiting_snapshot(definition, "task-3", attempt=3)
    events = InMemoryEventSink()
    reconciler = WorkflowTaskReconciler(
        repository=InMemoryTaskRepository(
            tables={
                "hermes_tasks": [
                    {"id": "task-3", "status": "FAILED", "error_message": "final agent error"}
                ]
            }
        ),
        clock=clock,
        event_sink=events,
    )

    updated = await reconciler.reconcile(definition, snapshot)

    assert updated.status is WorkflowStatus.FAILED
    assert updated.steps["research"].status is StepStatus.FAILED
    assert updated.steps["research"].task_id == "task-3"
    assert events.events[-1]["event"] == "workflow.step.reconciled.failed"
