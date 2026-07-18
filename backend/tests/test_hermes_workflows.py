from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from backend.hermes.testing import FrozenClock
from backend.hermes.workflows import (
    RetryPolicy,
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowStatus,
    WorkflowStepDefinition,
)


def definition() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="research-pipeline",
        steps=(
            WorkflowStepDefinition(id="plan", agent="TARS"),
            WorkflowStepDefinition(id="research", agent="ION", depends_on=("plan",)),
            WorkflowStepDefinition(
                id="review",
                agent="GUARDIAN",
                depends_on=("research",),
                requires_approval=True,
            ),
        ),
    )


def engine() -> WorkflowEngine:
    return WorkflowEngine(FrozenClock(datetime(2026, 7, 18, 2, 0, tzinfo=timezone.utc)))


def test_definition_rejects_unknown_dependency() -> None:
    with pytest.raises(ValidationError, match="unknown steps"):
        WorkflowDefinition(
            id="invalid",
            steps=(WorkflowStepDefinition(id="one", agent="TARS", depends_on=("missing",)),),
        )


def test_definition_rejects_cycles() -> None:
    with pytest.raises(ValidationError, match="cycle"):
        WorkflowDefinition(
            id="cycle",
            steps=(
                WorkflowStepDefinition(id="one", agent="TARS", depends_on=("two",)),
                WorkflowStepDefinition(id="two", agent="ION", depends_on=("one",)),
            ),
        )


def test_execution_releases_dependencies_in_definition_order() -> None:
    workflow = definition()
    runtime = engine()
    snapshot = runtime.create_execution(workflow, execution_id="exec-1")

    assert snapshot.status is WorkflowStatus.RUNNING
    assert runtime.ready_step_ids(workflow, snapshot) == ("plan",)

    snapshot = runtime.mark_running(snapshot, "plan", task_id="task-1")
    assert snapshot.steps["plan"].attempt == 1
    assert snapshot.steps["plan"].started_at == "2026-07-18T02:00:00+00:00"

    snapshot = runtime.complete_step(workflow, snapshot, "plan", output={"ok": True})
    assert snapshot.steps["plan"].status is StepStatus.COMPLETED
    assert runtime.ready_step_ids(workflow, snapshot) == ("research",)

    snapshot = runtime.mark_running(snapshot, "research")
    snapshot = runtime.complete_step(workflow, snapshot, "research")
    assert snapshot.steps["review"].status is StepStatus.WAITING
    assert runtime.ready_step_ids(workflow, snapshot) == ()


def test_retry_then_terminal_failure() -> None:
    workflow = WorkflowDefinition(
        id="retry",
        steps=(
            WorkflowStepDefinition(
                id="work",
                agent="ION",
                retry=RetryPolicy(max_attempts=2),
            ),
        ),
    )
    runtime = engine()
    snapshot = runtime.create_execution(workflow, execution_id="exec-2")
    snapshot = runtime.mark_running(snapshot, "work")
    snapshot = runtime.fail_step(workflow, snapshot, "work", error="first")
    assert snapshot.status is WorkflowStatus.RUNNING
    assert snapshot.steps["work"].status is StepStatus.READY

    snapshot = runtime.mark_running(snapshot, "work")
    snapshot = runtime.fail_step(workflow, snapshot, "work", error="second")
    assert snapshot.status is WorkflowStatus.FAILED
    assert snapshot.steps["work"].status is StepStatus.FAILED
    assert snapshot.steps["work"].attempt == 2


def test_pause_resume_and_checkpoint_are_durable() -> None:
    workflow = definition()
    runtime = engine()
    snapshot = runtime.create_execution(workflow, execution_id="exec-3")
    snapshot = runtime.pause(snapshot)
    assert snapshot.status is WorkflowStatus.PAUSED

    serialized = snapshot.model_dump_json()
    restored = type(snapshot).model_validate_json(serialized)
    restored = runtime.checkpoint(restored)
    restored = runtime.resume(workflow, restored)

    assert restored.checkpoint_sequence == 1
    assert restored.status is WorkflowStatus.RUNNING
    assert runtime.ready_step_ids(workflow, restored) == ("plan",)


def test_all_steps_complete_workflow() -> None:
    workflow = WorkflowDefinition(
        id="single",
        steps=(WorkflowStepDefinition(id="only", agent="TARS"),),
    )
    runtime = engine()
    snapshot = runtime.create_execution(workflow)
    snapshot = runtime.mark_running(snapshot, "only")
    snapshot = runtime.complete_step(workflow, snapshot, "only")

    assert snapshot.status is WorkflowStatus.COMPLETED
    assert runtime.unfinished_step_ids(snapshot) == ()
