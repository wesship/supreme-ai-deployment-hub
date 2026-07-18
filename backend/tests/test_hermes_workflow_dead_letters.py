from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryCheckpointStore, InMemoryEventSink
from backend.hermes.workflows import (
    DeadLetterDisposition,
    StepStatus,
    WorkflowDeadLetterService,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowRecoveryService,
    WorkflowStatus,
    WorkflowStepDefinition,
    dead_letter_key,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    clock = FrozenClock(datetime(2026, 7, 18, 6, 0, 0, tzinfo=timezone.utc))
    checkpoints = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    recovery = WorkflowRecoveryService(store=checkpoints, clock=clock, event_sink=events)
    service = WorkflowDeadLetterService(recovery=recovery, clock=clock, event_sink=events)
    return service, recovery, checkpoints, events, clock


def definition() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="dead-letter-flow",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(id="prepare", agent="ION"),
            WorkflowStepDefinition(id="execute", agent="TARS", depends_on=("prepare",)),
            WorkflowStepDefinition(id="report", agent="SAPPHIRE", depends_on=("execute",)),
            WorkflowStepDefinition(id="independent", agent="ION"),
        ),
    )


def failed_snapshot(defn: WorkflowDefinition, clock: FrozenClock):
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(defn, execution_id="exec-dead-letter")
    snapshot.steps["prepare"].status = StepStatus.COMPLETED
    snapshot.steps["prepare"].output = {"prepared": True}
    snapshot.steps["prepare"].completed_at = clock.current.isoformat()
    snapshot.steps["execute"].status = StepStatus.FAILED
    snapshot.steps["execute"].attempt = 3
    snapshot.steps["execute"].error = "provider unavailable"
    snapshot.steps["execute"].error_type = "timeout"
    snapshot.steps["execute"].dead_letter_ready = True
    snapshot.steps["execute"].completed_at = clock.current.isoformat()
    snapshot.steps["report"].status = StepStatus.PENDING
    snapshot.steps["independent"].status = StepStatus.COMPLETED
    snapshot.steps["independent"].output = {"kept": True}
    snapshot.status = WorkflowStatus.FAILED
    return snapshot


def test_register_is_idempotent_and_occ_projection_is_ready() -> None:
    service, _, checkpoints, events, clock = build_runtime()
    defn = definition()
    snapshot = failed_snapshot(defn, clock)

    first = run(service.register(defn, snapshot, user_id="user-1", goal_id="goal-1"))
    second = run(service.register(defn, first, user_id="user-1", goal_id="goal-1"))

    key = dead_letter_key(execution_id="exec-dead-letter", step_id="execute", attempt=3)
    assert key in first.metadata["dead_letters"]
    assert first.metadata["dead_letters"][key]["status"] == "pending"
    assert len(second.metadata["dead_letters"]) == 1
    assert len(checkpoints.records) == 1
    assert [event["event"] for event in events.events].count("workflow.dead_letter.created") == 1
    projection = service.occ_projection(second)
    assert projection[0]["step_id"] == "execute"
    assert projection[0]["error_type"] == "timeout"


def test_operator_retry_resets_only_failed_step() -> None:
    service, _, _, events, clock = build_runtime()
    defn = definition()
    registered = run(
        service.register(defn, failed_snapshot(defn, clock), user_id="user-1", goal_id="goal-1")
    )
    key = next(iter(registered.metadata["dead_letters"]))

    retried = run(
        service.review(
            defn,
            registered,
            record_key=key,
            disposition=DeadLetterDisposition.RETRY,
            actor_id="operator-1",
            reason="provider recovered",
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert retried.status is WorkflowStatus.RUNNING
    assert retried.steps["execute"].status is StepStatus.READY
    assert retried.steps["execute"].error is None
    assert retried.steps["prepare"].status is StepStatus.COMPLETED
    assert retried.steps["independent"].output == {"kept": True}
    record = retried.metadata["dead_letters"][key]
    assert record["status"] == "retry"
    assert record["reviewed_by"] == "operator-1"
    assert events.events[-2]["event"] == "workflow.dead_letter.retry"


def test_dismiss_and_cancel_are_terminal_and_duplicate_review_is_rejected() -> None:
    service, _, _, _, clock = build_runtime()
    defn = definition()
    registered = run(
        service.register(defn, failed_snapshot(defn, clock), user_id="user-1", goal_id="goal-1")
    )
    key = next(iter(registered.metadata["dead_letters"]))

    dismissed = run(
        service.review(
            defn,
            registered,
            record_key=key,
            disposition=DeadLetterDisposition.DISMISSED,
            actor_id="operator-1",
            reason="expected permanent failure",
            user_id="user-1",
            goal_id="goal-1",
        )
    )
    assert dismissed.status is WorkflowStatus.FAILED
    with pytest.raises(ValueError, match="already been reviewed"):
        run(
            service.review(
                defn,
                dismissed,
                record_key=key,
                disposition=DeadLetterDisposition.CANCELLED,
                actor_id="operator-2",
                reason="late cancel",
                user_id="user-1",
                goal_id="goal-1",
            )
        )

    second_registered = run(
        service.register(defn, failed_snapshot(defn, clock), user_id="user-2", goal_id="goal-2")
    )
    second_key = next(iter(second_registered.metadata["dead_letters"]))
    cancelled = run(
        service.review(
            defn,
            second_registered,
            record_key=second_key,
            disposition=DeadLetterDisposition.CANCELLED,
            actor_id="operator-2",
            reason="unsafe to continue",
            user_id="user-2",
            goal_id="goal-2",
        )
    )
    assert cancelled.status is WorkflowStatus.CANCELLED
    assert cancelled.steps["execute"].status is StepStatus.CANCELLED


def test_replay_preserves_upstream_and_resets_failed_downstream_only() -> None:
    service, recovery, checkpoints, events, clock = build_runtime()
    defn = definition()
    source = failed_snapshot(defn, clock)
    source = run(recovery.save(defn, source, user_id="user-1", goal_id="goal-1"))
    registered = run(service.register(defn, source, user_id="user-1", goal_id="goal-1"))
    key = next(iter(registered.metadata["dead_letters"]))
    source_sequence = source.checkpoint_sequence

    reviewed, replayed = run(
        service.replay(
            defn,
            registered,
            record_key=key,
            source_sequence=source_sequence,
            actor_id="operator-1",
            reason="replay after provider recovery",
            user_id="user-1",
            goal_id="goal-1",
            new_execution_id="exec-replayed",
        )
    )

    assert reviewed.metadata["dead_letters"][key]["status"] == "replay"
    assert reviewed.metadata["dead_letters"][key]["replay_execution_id"] == "exec-replayed"
    assert replayed.execution_id == "exec-replayed"
    assert replayed.metadata["dead_letter_replay"]["source_execution_id"] == "exec-dead-letter"
    assert replayed.steps["prepare"].status is StepStatus.COMPLETED
    assert replayed.steps["prepare"].output == {"prepared": True}
    assert replayed.steps["execute"].status is StepStatus.READY
    assert replayed.steps["execute"].attempt == 3
    assert replayed.steps["execute"].dead_letter_ready is False
    assert replayed.steps["report"].status is StepStatus.READY
    assert replayed.steps["independent"].status is StepStatus.COMPLETED
    assert replayed.steps["independent"].output == {"kept": True}
    assert any(event["event"] == "workflow.dead_letter.replayed" for event in events.events)
    assert any(record["execution_id"] == "exec-replayed" for record in checkpoints.records)
