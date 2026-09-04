"""Deterministic state transitions for durable Hermes workflows."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import uuid4

from backend.hermes.ports import Clock
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
    WorkflowStepState,
)


_TERMINAL_STEPS = {
    StepStatus.COMPLETED,
    StepStatus.FAILED,
    StepStatus.SKIPPED,
    StepStatus.CANCELLED,
}


class WorkflowEngine:
    """Pure workflow state machine with deterministic ready-step ordering."""

    def __init__(self, clock: Clock) -> None:
        self._clock = clock

    def create_execution(
        self,
        definition: WorkflowDefinition,
        *,
        execution_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> WorkflowExecutionSnapshot:
        now = self._clock.now().isoformat()
        snapshot = WorkflowExecutionSnapshot(
            execution_id=execution_id or str(uuid4()),
            workflow_id=definition.id,
            workflow_version=definition.version,
            steps={step.id: WorkflowStepState(step_id=step.id) for step in definition.steps},
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        )
        return self.refresh_ready_steps(definition, snapshot)

    def refresh_ready_steps(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        if updated.status in {WorkflowStatus.PAUSED, WorkflowStatus.CANCELLED, WorkflowStatus.FAILED}:
            return updated

        for step in definition.steps:
            state = updated.steps[step.id]
            if state.status is not StepStatus.PENDING:
                continue
            if all(updated.steps[dependency].status is StepStatus.COMPLETED for dependency in step.depends_on):
                state.status = StepStatus.WAITING if step.requires_approval else StepStatus.READY

        if updated.status is WorkflowStatus.PENDING and any(
            state.status in {StepStatus.READY, StepStatus.WAITING} for state in updated.steps.values()
        ):
            updated.status = WorkflowStatus.RUNNING
        self._touch(updated)
        return updated

    def ready_step_ids(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> tuple[str, ...]:
        order = {step.id: index for index, step in enumerate(definition.steps)}
        return tuple(
            sorted(
                (step_id for step_id, state in snapshot.steps.items() if state.status is StepStatus.READY),
                key=order.__getitem__,
            )
        )

    def mark_running(
        self,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        *,
        task_id: str | None = None,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        state = self._require_step(updated, step_id)
        if state.status is not StepStatus.READY:
            raise ValueError(f"step {step_id} is not ready")
        state.status = StepStatus.RUNNING
        state.attempt += 1
        state.task_id = task_id
        state.started_at = self._clock.now().isoformat()
        self._touch(updated)
        return updated

    def complete_step(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        *,
        output: dict[str, Any] | None = None,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        state = self._require_step(updated, step_id)
        if state.status is not StepStatus.RUNNING:
            raise ValueError(f"step {step_id} is not running")
        state.status = StepStatus.COMPLETED
        state.output = output
        state.completed_at = self._clock.now().isoformat()
        self._touch(updated)
        updated = self.refresh_ready_steps(definition, updated)
        if all(step_state.status is StepStatus.COMPLETED for step_state in updated.steps.values()):
            updated.status = WorkflowStatus.COMPLETED
            self._touch(updated)
        return updated

    def fail_step(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        *,
        error: str,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        state = self._require_step(updated, step_id)
        if state.status not in {StepStatus.RUNNING, StepStatus.WAITING}:
            raise ValueError(f"step {step_id} is not active")
        step = next(item for item in definition.steps if item.id == step_id)
        state.error = error
        state.completed_at = self._clock.now().isoformat()
        if state.attempt < step.retry.max_attempts:
            state.status = StepStatus.READY
            state.task_id = None
        else:
            state.status = StepStatus.FAILED
            updated.status = WorkflowStatus.FAILED
        self._touch(updated)
        return updated

    def pause(self, snapshot: WorkflowExecutionSnapshot) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        if updated.status not in {WorkflowStatus.RUNNING, WorkflowStatus.PENDING}:
            raise ValueError(f"workflow cannot be paused from {updated.status}")
        updated.status = WorkflowStatus.PAUSED
        self._touch(updated)
        return updated

    def resume(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        if updated.status is not WorkflowStatus.PAUSED:
            raise ValueError("workflow is not paused")
        updated.status = WorkflowStatus.RUNNING
        self._touch(updated)
        return self.refresh_ready_steps(definition, updated)

    def checkpoint(self, snapshot: WorkflowExecutionSnapshot) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        updated.checkpoint_sequence += 1
        self._touch(updated)
        return updated

    @staticmethod
    def unfinished_step_ids(snapshot: WorkflowExecutionSnapshot) -> tuple[str, ...]:
        return tuple(
            step_id
            for step_id, state in snapshot.steps.items()
            if state.status not in _TERMINAL_STEPS
        )

    @staticmethod
    def _require_step(snapshot: WorkflowExecutionSnapshot, step_id: str) -> WorkflowStepState:
        try:
            return snapshot.steps[step_id]
        except KeyError as exc:
            raise ValueError(f"unknown workflow step: {step_id}") from exc

    def _touch(self, snapshot: WorkflowExecutionSnapshot) -> None:
        snapshot.updated_at = self._clock.now().isoformat()
