"""Checkpoint-safe cancellation propagation and timeout enforcement."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.ports import Clock, EventSink, TaskRepository
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)
from backend.hermes.workflows.retries import WorkflowRetryService

_TERMINAL_STEPS = {
    StepStatus.COMPLETED,
    StepStatus.FAILED,
    StepStatus.SKIPPED,
    StepStatus.CANCELLED,
}


class WorkflowLifecycleService:
    """Apply idempotent cancellation and deterministic deadline enforcement."""

    def __init__(
        self,
        *,
        repository: TaskRepository,
        recovery: WorkflowRecoveryService,
        retry_service: WorkflowRetryService,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._repository = repository
        self._recovery = recovery
        self._retries = retry_service
        self._clock = clock
        self._events = event_sink

    def initialize_deadlines(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> WorkflowExecutionSnapshot:
        """Attach stable workflow and step deadlines without persistence side effects."""
        self._validate(definition, snapshot)
        updated = snapshot.model_copy(deep=True)
        created = self._parse(updated.created_at)
        if definition.timeout_seconds and not updated.deadline_at:
            updated.deadline_at = (created + timedelta(seconds=definition.timeout_seconds)).isoformat()
        definitions = {step.id: step for step in definition.steps}
        for step_id, state in updated.steps.items():
            timeout = definitions[step_id].timeout_seconds
            if timeout and state.started_at and not state.deadline_at:
                state.deadline_at = (
                    self._parse(state.started_at) + timedelta(seconds=timeout)
                ).isoformat()
        return updated

    async def cancel(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
        actor_id: str,
        reason: str,
    ) -> WorkflowExecutionSnapshot:
        """Cancel all non-terminal steps and their bound tasks exactly once."""
        self._validate(definition, snapshot)
        if snapshot.status is WorkflowStatus.CANCELLED:
            return snapshot.model_copy(deep=True)
        if snapshot.status is WorkflowStatus.COMPLETED:
            raise ValueError("completed workflows cannot be cancelled")

        updated = snapshot.model_copy(deep=True)
        now = self._now().isoformat()
        await self._events.emit(
            {
                "event": "workflow.cancellation.requested",
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "actor_id": actor_id,
                "reason": reason,
            }
        )

        cancelled_steps: list[str] = []
        for step_id, state in updated.steps.items():
            if state.status in _TERMINAL_STEPS:
                continue
            if state.task_id:
                await self._repository.update_row(
                    "hermes_tasks",
                    state.task_id,
                    {
                        "status": TaskStatus.CANCELLED.value,
                        "error_message": reason,
                        "completed_at": now,
                    },
                )
            state.status = StepStatus.CANCELLED
            state.error = reason
            state.error_type = "cancelled"
            state.completed_at = now
            state.next_retry_at = None
            state.retry_delay_seconds = None
            state.dead_letter_ready = False
            cancelled_steps.append(step_id)
            await self._events.emit(
                {
                    "event": "workflow.step.cancelled",
                    "execution_id": updated.execution_id,
                    "workflow_id": updated.workflow_id,
                    "step_id": step_id,
                    "task_id": state.task_id,
                    "actor_id": actor_id,
                    "reason": reason,
                }
            )

        updated.status = WorkflowStatus.CANCELLED
        updated.updated_at = now
        updated.metadata = {
            **updated.metadata,
            "cancellation": {
                "actor_id": actor_id,
                "reason": reason,
                "requested_at": now,
                "cancelled_steps": cancelled_steps,
            },
        }
        updated = await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )
        await self._events.emit(
            {
                "event": "workflow.cancelled",
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "actor_id": actor_id,
                "reason": reason,
                "cancelled_steps": cancelled_steps,
            }
        )
        return updated

    async def enforce_timeouts(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        """Cancel expired workflows and route overdue steps through retry policy."""
        self._validate(definition, snapshot)
        updated = self.initialize_deadlines(definition, snapshot)
        now = self._now()
        if updated.status in {WorkflowStatus.CANCELLED, WorkflowStatus.COMPLETED}:
            return updated

        if updated.deadline_at and now >= self._parse(updated.deadline_at):
            await self._events.emit(
                {
                    "event": "workflow.deadline.exceeded",
                    "execution_id": updated.execution_id,
                    "workflow_id": updated.workflow_id,
                    "deadline_at": updated.deadline_at,
                }
            )
            return await self.cancel(
                definition,
                updated,
                user_id=user_id,
                goal_id=goal_id,
                actor_id="hermes-timeout-monitor",
                reason="workflow deadline exceeded",
            )

        definitions = {step.id: step for step in definition.steps}
        for step_id in tuple(updated.steps):
            state = updated.steps[step_id]
            if state.status not in {StepStatus.RUNNING, StepStatus.WAITING}:
                continue
            timeout = definitions[step_id].timeout_seconds
            if not timeout or not state.started_at:
                continue
            deadline = state.deadline_at or (
                self._parse(state.started_at) + timedelta(seconds=timeout)
            ).isoformat()
            state.deadline_at = deadline
            if now < self._parse(deadline):
                continue

            if state.task_id:
                await self._repository.update_row(
                    "hermes_tasks",
                    state.task_id,
                    {
                        "status": TaskStatus.FAILED.value,
                        "error_message": "step timeout exceeded",
                        "completed_at": now.isoformat(),
                    },
                )
            await self._events.emit(
                {
                    "event": "workflow.step.timed_out",
                    "execution_id": updated.execution_id,
                    "workflow_id": updated.workflow_id,
                    "step_id": step_id,
                    "task_id": state.task_id,
                    "deadline_at": deadline,
                }
            )
            updated = await self._retries.schedule_failure(
                definition,
                updated,
                step_id=step_id,
                error="step timeout exceeded",
                error_type="timeout",
                user_id=user_id,
                goal_id=goal_id,
            )
        return updated

    @staticmethod
    def occ_projection(snapshot: WorkflowExecutionSnapshot) -> dict[str, Any]:
        timed = [
            step_id
            for step_id, state in snapshot.steps.items()
            if state.error_type == "timeout"
        ]
        return {
            "status": snapshot.status.value,
            "workflow_deadline_at": snapshot.deadline_at,
            "cancelled": snapshot.status is WorkflowStatus.CANCELLED,
            "cancellation": snapshot.metadata.get("cancellation"),
            "timed_out_steps": timed,
            "step_deadlines": {
                step_id: state.deadline_at
                for step_id, state in snapshot.steps.items()
                if state.deadline_at
            },
        }

    def _now(self) -> datetime:
        value = self._clock.now()
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    @staticmethod
    def _parse(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    @staticmethod
    def _validate(
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> None:
        if snapshot.workflow_id != definition.id:
            raise ValueError("workflow definition id does not match execution")
        if snapshot.workflow_version != definition.version:
            raise ValueError("workflow definition version does not match execution")
        if set(snapshot.steps) != {step.id for step in definition.steps}:
            raise ValueError("workflow step set does not match definition")
