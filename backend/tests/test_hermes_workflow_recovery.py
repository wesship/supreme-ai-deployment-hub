from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryCheckpointStore, InMemoryEventSink
from backend.hermes.workflows import (
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowRecoveryService,
    WorkflowStepDefinition,
)


def _definition() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="recovery-demo",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(id="plan", agent="TARS"),
            WorkflowStepDefinition(id="execute", agent="ION", depends_on=("plan",)),
        ),
    )


def _service() -> tuple[WorkflowRecoveryService, InMemoryCheckpointStore, InMemoryEventSink, FrozenClock]:
    clock = FrozenClock(datetime(2026, 7, 18, 2, 0, tzinfo=timezone.utc))
    store = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    return (
        WorkflowRecoveryService(store=store, clock=clock, event_sink=events),
        store,
        events,
        clock,
    )


@pytest.mark.asyncio
async def test_save_and_recover_latest_checkpoint() -> None:
    definition = _definition()
    service, store, events, clock = _service()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-1")
    snapshot = engine.mark_running(snapshot, "plan", task_id="task-1")

    checkpointed = await service.save(
        definition,
        snapshot,
        user_id="user-1",
        goal_id="goal-1",
    )
    recovered = await service.recover_latest(
        definition,
        goal_id="goal-1",
        execution_id="exec-1",
    )

    assert checkpointed.checkpoint_sequence == 1
    assert len(store.records) == 1
    assert recovered.steps["plan"].status is StepStatus.WAITING
    assert recovered.steps["plan"].task_id == "task-1"
    assert recovered.steps["plan"].error == "recovery requires task reconciliation"
    assert [event["event"] for event in events.events] == [
        "workflow.checkpoint.saved",
        "workflow.recovered",
    ]


@pytest.mark.asyncio
async def test_recovery_returns_undispatched_running_step_to_ready() -> None:
    definition = _definition()
    service, _, _, clock = _service()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-2")
    snapshot = engine.mark_running(snapshot, "plan")
    await service.save(definition, snapshot, user_id="user-1", goal_id="goal-1")

    recovered = await service.recover_latest(
        definition,
        goal_id="goal-1",
        execution_id="exec-2",
    )

    assert recovered.steps["plan"].status is StepStatus.READY
    assert recovered.steps["plan"].error == "recovered before task dispatch"


@pytest.mark.asyncio
async def test_replay_uses_selected_checkpoint_and_new_execution_identity() -> None:
    definition = _definition()
    service, _, events, clock = _service()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-source")
    first = await service.save(definition, snapshot, user_id="user-1", goal_id="goal-1")
    running = engine.mark_running(first, "plan", task_id="task-1")
    second = await service.save(definition, running, user_id="user-1", goal_id="goal-1")

    replayed = await service.replay(
        definition,
        goal_id="goal-1",
        execution_id="exec-source",
        sequence=second.checkpoint_sequence,
        new_execution_id="exec-replay",
    )

    assert replayed.execution_id == "exec-replay"
    assert replayed.checkpoint_sequence == 0
    assert replayed.metadata["replay_of_execution_id"] == "exec-source"
    assert replayed.metadata["replay_of_sequence"] == 2
    assert replayed.steps["plan"].status is StepStatus.WAITING
    assert events.events[-1]["event"] == "workflow.replayed"


@pytest.mark.asyncio
async def test_recovery_rejects_definition_version_mismatch() -> None:
    definition = _definition()
    service, _, _, clock = _service()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-3")
    await service.save(definition, snapshot, user_id="user-1", goal_id="goal-1")
    incompatible = definition.model_copy(update={"version": "2.0.0"})

    with pytest.raises(ValueError, match="version"):
        await service.recover_latest(
            incompatible,
            goal_id="goal-1",
            execution_id="exec-3",
        )


@pytest.mark.asyncio
async def test_recovery_rejects_tampered_checkpoint() -> None:
    definition = _definition()
    service, store, _, clock = _service()
    engine = WorkflowEngine(clock)
    snapshot = engine.create_execution(definition, execution_id="exec-4")
    await service.save(definition, snapshot, user_id="user-1", goal_id="goal-1")
    store.records[0]["envelope"]["snapshot"]["status"] = "FAILED"

    with pytest.raises(ValueError, match="checksum"):
        await service.recover_latest(
            definition,
            goal_id="goal-1",
            execution_id="exec-4",
        )
