"""Deterministic, checkpoint-safe retry scheduling for Hermes workflows."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from backend.hermes.ports import Clock, EventSink
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)


class WorkflowRetryService:
    def __init__(
        self,
        *,
        recovery: WorkflowRecoveryService,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._recovery = recovery
        self._clock = clock
        self._events = event_sink

    async def schedule_failure(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        step_id: str,
        error: str,
        error_type: str = "error",
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        step = next((item for item in definition.steps if item.id == step_id), None)
        if step is None:
            raise ValueError(f"unknown workflow step: {step_id}")
        state = updated.steps[step_id]
        if state.status not in {StepStatus.RUNNING, StepStatus.WAITING}:
            raise ValueError(f"step {step_id} is not active")

        state.error = error
        state.error_type = error_type
        state.task_id = None
        state.completed_at = self._now().isoformat()

        retryable = not step.retry.retryable_errors or error_type in step.retry.retryable_errors
        if retryable and state.attempt < step.retry.max_attempts:
            delay = self._delay_seconds(
                execution_id=updated.execution_id,
                step_id=step_id,
                attempt=state.attempt,
                base=step.retry.backoff_seconds,
                multiplier=step.retry.backoff_multiplier,
                maximum=step.retry.max_backoff_seconds,
                jitter_ratio=step.retry.jitter_ratio,
            )
            state.status = StepStatus.WAITING
            state.retry_delay_seconds = delay
            state.next_retry_at = (self._now() + timedelta(seconds=delay)).isoformat()
            state.dead_letter_ready = False
            updated.status = WorkflowStatus.RUNNING
            event = "workflow.step.retry.scheduled"
        else:
            state.status = StepStatus.FAILED
            state.next_retry_at = None
            state.retry_delay_seconds = None
            state.dead_letter_ready = True
            updated.status = WorkflowStatus.FAILED
            event = "workflow.step.retry.exhausted" if retryable else "workflow.step.retry.ineligible"

        updated.updated_at = self._now().isoformat()
        await self._events.emit(
            {
                "event": event,
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "step_id": step_id,
                "attempt": state.attempt,
                "next_retry_at": state.next_retry_at,
                "retry_delay_seconds": state.retry_delay_seconds,
                "error_type": error_type,
                "dead_letter_ready": state.dead_letter_ready,
            }
        )
        return await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )

    async def release_due(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        released: list[str] = []
        now = self._now()
        for step_id, state in updated.steps.items():
            if state.status is not StepStatus.WAITING or not state.next_retry_at:
                continue
            retry_at = self._parse(state.next_retry_at)
            if now < retry_at:
                continue
            state.status = StepStatus.READY
            state.next_retry_at = None
            state.retry_delay_seconds = None
            state.error = None
            state.error_type = None
            state.completed_at = None
            released.append(step_id)

        if not released:
            return updated

        updated.status = WorkflowStatus.RUNNING
        updated.updated_at = now.isoformat()
        for step_id in released:
            await self._events.emit(
                {
                    "event": "workflow.step.retry.released",
                    "execution_id": updated.execution_id,
                    "workflow_id": updated.workflow_id,
                    "step_id": step_id,
                    "attempt": updated.steps[step_id].attempt,
                }
            )
        return await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )

    @staticmethod
    def _delay_seconds(
        *,
        execution_id: str,
        step_id: str,
        attempt: int,
        base: float,
        multiplier: float,
        maximum: float,
        jitter_ratio: float,
    ) -> float:
        delay = min(base * (multiplier ** max(attempt - 1, 0)), maximum)
        if delay == 0 or jitter_ratio == 0:
            return delay
        digest = hashlib.sha256(f"{execution_id}:{step_id}:{attempt}".encode()).digest()
        unit = int.from_bytes(digest[:8], "big") / ((1 << 64) - 1)
        factor = 1 - jitter_ratio + (2 * jitter_ratio * unit)
        return round(max(0.0, delay * factor), 6)

    def _now(self) -> datetime:
        value = self._clock.now()
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    @staticmethod
    def _parse(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
