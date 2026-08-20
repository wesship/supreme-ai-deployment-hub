"""Restart-safe task reconciliation and deterministic dispatch identity."""

from __future__ import annotations

import hashlib
from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.ports import Clock, EventSink, TaskRepository
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)


def dispatch_idempotency_key(*, execution_id: str, step_id: str, attempt: int) -> str:
    """Return a stable key for one workflow execution-step-attempt tuple."""
    if attempt < 1:
        raise ValueError("attempt must be at least 1")
    raw = f"{execution_id}:{step_id}:{attempt}".encode()
    return hashlib.sha256(raw).hexdigest()


class WorkflowTaskReconciler:
    """Reconcile checkpoint-bound workflow steps against persisted Hermes tasks."""

    def __init__(
        self,
        *,
        repository: TaskRepository,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._repository = repository
        self._clock = clock
        self._events = event_sink
        self._engine = WorkflowEngine(clock)

    async def reconcile(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> WorkflowExecutionSnapshot:
        self._validate_definition(definition, snapshot)
        updated = snapshot.model_copy(deep=True)

        for step in definition.steps:
            state = updated.steps[step.id]
            if state.status is not StepStatus.WAITING or not state.task_id:
                continue

            rows = await self._repository.list_rows(
                "hermes_tasks",
                {"id": f"eq.{state.task_id}", "limit": "1"},
            )
            if not rows:
                state.status = StepStatus.READY
                state.task_id = None
                state.error = "bound task record not found during recovery"
                state.completed_at = None
                await self._emit("workflow.step.released", updated, step.id)
                continue

            task = rows[0]
            task_status = TaskStatus(task["status"])
            if task_status is TaskStatus.COMPLETED:
                state.status = StepStatus.COMPLETED
                state.output = self._task_output(task)
                state.error = None
                state.completed_at = task.get("completed_at") or self._clock.now().isoformat()
                await self._emit("workflow.step.reconciled.completed", updated, step.id)
            elif task_status is TaskStatus.FAILED:
                error = task.get("error_message") or "bound task failed"
                updated = self._engine.fail_step(
                    definition,
                    updated,
                    step.id,
                    error=error,
                )
                if updated.steps[step.id].status is StepStatus.READY:
                    await self._emit("workflow.step.reconciled.retry", updated, step.id)
                else:
                    await self._emit("workflow.step.reconciled.failed", updated, step.id)
            elif task_status is TaskStatus.CANCELLED:
                state.status = StepStatus.CANCELLED
                state.error = task.get("error_message")
                state.completed_at = task.get("completed_at") or self._clock.now().isoformat()
                updated.status = WorkflowStatus.CANCELLED
                await self._emit("workflow.step.reconciled.cancelled", updated, step.id)
            else:
                await self._emit("workflow.step.reconciled.active", updated, step.id)

        if updated.status is WorkflowStatus.RUNNING and all(
            state.status is StepStatus.COMPLETED for state in updated.steps.values()
        ):
            updated.status = WorkflowStatus.COMPLETED

        updated.updated_at = self._clock.now().isoformat()
        return updated

    @staticmethod
    def _task_output(task: dict[str, Any]) -> dict[str, Any] | None:
        output = task.get("output_data")
        if output is None:
            output = task.get("result")
        return output if isinstance(output, dict) else None

    async def _emit(
        self,
        event: str,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
    ) -> None:
        state = snapshot.steps[step_id]
        await self._events.emit(
            {
                "event": event,
                "execution_id": snapshot.execution_id,
                "workflow_id": snapshot.workflow_id,
                "step_id": step_id,
                "task_id": state.task_id,
                "status": state.status.value,
            }
        )

    @staticmethod
    def _validate_definition(
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> None:
        if snapshot.workflow_id != definition.id:
            raise ValueError("workflow definition id does not match execution")
        if snapshot.workflow_version != definition.version:
            raise ValueError("workflow definition version does not match execution")
        if set(snapshot.steps) != {step.id for step in definition.steps}:
            raise ValueError("workflow step set does not match definition")
