from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from backend.hermes.testing import FrozenClock, InMemoryCheckpointStore, InMemoryEventSink
from backend.hermes.workflows import (
    RetryPolicy,
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowRecoveryService,
    WorkflowRetryService,
    WorkflowStatus,
    WorkflowStepDefinition,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    clock = FrozenClock(datetime(2026, 7, 18, 5, 0, 0, tzinfo=timezone.utc))
    checkpoints = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    recovery = WorkflowRecoveryService(store=checkpoints, clock=clock, event_sink=events)
    retries = WorkflowRetryService(recovery=recovery, clock=clock, event_sink=events)
    return retries, checkpoints, events, clock


def definition(policy: RetryPolicy) -> WorkflowDefinition:
    return WorkflowDefinition(
        id="retry-flow",
        version="1.0.0",
        steps=(WorkflowStepDefinition(id="work", agent="TARS", retry=policy),),
    )


def active_snapshot(defn: WorkflowDefinition, clock: FrozenClock):
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-retry")
    return engine.mark_running(snapshot, "work", task_id="task-1")


def test_failure_schedules_exponential_retry_and_checkpoint() -> None:
    retries, checkpoints, events, clock = build_runtime()
    defn = definition(RetryPolicy(max_attempts=3, backoff_seconds=10, backoff_multiplier=2))
    snapshot = active_snapshot(defn, clock)

    scheduled = run(
        retries.schedule_failure(
            defn,
            snapshot,
            step_id="work",
            error="temporary",
            error_type="timeout",
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    state = scheduled.steps["work"]
    assert state.status is StepStatus.WAITING
    assert state.retry_delay_seconds == 10
    assert state.next_retry_at == (clock.current + timedelta(seconds=10)).isoformat()
    assert state.task_id is None
    assert scheduled.status is WorkflowStatus.RUNNING
    assert len(checkpoints.records) == 1
    assert [event["event"] for event in events.events[-2:]] == [
        "workflow.step.retry.scheduled",
        "workflow.checkpoint.saved",
    ]


def test_retry_is_not_released_before_deadline_then_becomes_ready() -> None:
    retries, checkpoints, events, clock = build_runtime()
    defn = definition(RetryPolicy(max_attempts=3, backoff_seconds=30))
    snapshot = active_snapshot(defn, clock)
    scheduled = run(
        retries.schedule_failure(
            defn,
            snapshot,
            step_id="work",
            error="temporary",
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    unchanged = run(
        retries.release_due(defn, scheduled, user_id="user-1", goal_id="goal-1")
    )
    assert unchanged.steps["work"].status is StepStatus.WAITING
    assert len(checkpoints.records) == 1

    clock.current = clock.current + timedelta(seconds=30)
    released = run(
        retries.release_due(defn, scheduled, user_id="user-1", goal_id="goal-1")
    )
    assert released.steps["work"].status is StepStatus.READY
    assert released.steps["work"].next_retry_at is None
    assert released.steps["work"].error is None
    assert len(checkpoints.records) == 2
    assert [event["event"] for event in events.events[-2:]] == [
        "workflow.step.retry.released",
        "workflow.checkpoint.saved",
    ]


def test_non_retryable_error_fails_immediately_and_is_dead_letter_ready() -> None:
    retries, _, events, clock = build_runtime()
    defn = definition(
        RetryPolicy(max_attempts=5, backoff_seconds=10, retryable_errors=("timeout",))
    )
    snapshot = active_snapshot(defn, clock)

    failed = run(
        retries.schedule_failure(
            defn,
            snapshot,
            step_id="work",
            error="permission denied",
            error_type="authorization",
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    state = failed.steps["work"]
    assert state.status is StepStatus.FAILED
    assert state.dead_letter_ready is True
    assert failed.status is WorkflowStatus.FAILED
    assert [event["event"] for event in events.events[-2:]] == [
        "workflow.step.retry.ineligible",
        "workflow.checkpoint.saved",
    ]


def test_exhausted_attempts_fail_permanently() -> None:
    retries, _, events, clock = build_runtime()
    defn = definition(RetryPolicy(max_attempts=1, backoff_seconds=10))
    snapshot = active_snapshot(defn, clock)

    failed = run(
        retries.schedule_failure(
            defn,
            snapshot,
            step_id="work",
            error="still failing",
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert failed.steps["work"].status is StepStatus.FAILED
    assert failed.steps["work"].dead_letter_ready is True
    assert failed.status is WorkflowStatus.FAILED
    assert [event["event"] for event in events.events[-2:]] == [
        "workflow.step.retry.exhausted",
        "workflow.checkpoint.saved",
    ]


def test_jitter_is_deterministic_for_same_execution_attempt() -> None:
    args = {
        "execution_id": "exec-1",
        "step_id": "work",
        "attempt": 2,
        "base": 10.0,
        "multiplier": 2.0,
        "maximum": 100.0,
        "jitter_ratio": 0.25,
    }
    first = WorkflowRetryService._delay_seconds(**args)
    second = WorkflowRetryService._delay_seconds(**args)
    assert first == second
    assert 15.0 <= first <= 25.0
