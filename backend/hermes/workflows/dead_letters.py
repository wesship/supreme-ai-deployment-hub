"""Durable dead-letter review and lineage-preserving replay for Hermes workflows."""

from __future__ import annotations

import hashlib
from enum import StrEnum
from typing import Any
from uuid import uuid4

from backend.hermes.ports import Clock, EventSink
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)


class DeadLetterDisposition(StrEnum):
    PENDING = "pending"
    RETRY = "retry"
    REPLAY = "replay"
    DISMISSED = "dismissed"
    CANCELLED = "cancelled"


def dead_letter_key(*, execution_id: str, step_id: str, attempt: int) -> str:
    return hashlib.sha256(f"{execution_id}:{step_id}:{attempt}:dead-letter".encode()).hexdigest()


class WorkflowDeadLetterService:
    """Checkpoint dead-letter records and apply operator dispositions."""

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

    async def register(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        """Register every dead-letter-ready failed step exactly once."""
        updated = snapshot.model_copy(deep=True)
        records = self._records(updated)
        changed = False
        for step_id, state in updated.steps.items():
            if state.status is not StepStatus.FAILED or not state.dead_letter_ready:
                continue
            key = dead_letter_key(
                execution_id=updated.execution_id,
                step_id=step_id,
                attempt=state.attempt,
            )
            if key in records:
                continue
            records[key] = {
                "key": key,
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "workflow_version": updated.workflow_version,
                "step_id": step_id,
                "attempt": state.attempt,
                "error": state.error,
                "error_type": state.error_type,
                "status": DeadLetterDisposition.PENDING.value,
                "created_at": self._clock.now().isoformat(),
                "reviewed_at": None,
                "reviewed_by": None,
                "reason": None,
                "replay_execution_id": None,
            }
            changed = True
            await self._emit("workflow.dead_letter.created", updated, records[key])

        if not changed:
            return updated
        updated.metadata["dead_letters"] = records
        return await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )

    async def review(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        record_key: str,
        disposition: DeadLetterDisposition,
        actor_id: str,
        reason: str,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        """Checkpoint an operator decision except replay, which uses ``replay``."""
        if disposition in {DeadLetterDisposition.PENDING, DeadLetterDisposition.REPLAY}:
            raise ValueError("use a terminal review disposition or replay()")
        updated = snapshot.model_copy(deep=True)
        records = self._records(updated)
        record = self._require_pending(records, record_key)
        state = updated.steps[str(record["step_id"])]

        record.update(
            {
                "status": disposition.value,
                "reviewed_at": self._clock.now().isoformat(),
                "reviewed_by": actor_id,
                "reason": reason,
            }
        )
        if disposition is DeadLetterDisposition.RETRY:
            self._reset_state(state)
            updated.status = WorkflowStatus.RUNNING
        elif disposition is DeadLetterDisposition.CANCELLED:
            state.status = StepStatus.CANCELLED
            state.completed_at = self._clock.now().isoformat()
            updated.status = WorkflowStatus.CANCELLED
        elif disposition is DeadLetterDisposition.DISMISSED:
            updated.status = WorkflowStatus.FAILED

        updated.metadata["dead_letters"] = records
        await self._emit(f"workflow.dead_letter.{disposition.value}", updated, record)
        return await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )

    async def replay(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        record_key: str,
        source_sequence: int,
        actor_id: str,
        reason: str,
        user_id: str,
        goal_id: str,
        new_execution_id: str | None = None,
    ) -> tuple[WorkflowExecutionSnapshot, WorkflowExecutionSnapshot]:
        """Checkpoint the replay decision and create a lineage-linked execution."""
        reviewed = snapshot.model_copy(deep=True)
        records = self._records(reviewed)
        record = self._require_pending(records, record_key)
        failed_step_id = str(record["step_id"])
        replay_execution_id = new_execution_id or str(uuid4())

        record.update(
            {
                "status": DeadLetterDisposition.REPLAY.value,
                "reviewed_at": self._clock.now().isoformat(),
                "reviewed_by": actor_id,
                "reason": reason,
                "replay_execution_id": replay_execution_id,
                "source_sequence": source_sequence,
            }
        )
        reviewed.metadata["dead_letters"] = records
        reviewed = await self._recovery.save(
            definition,
            reviewed,
            user_id=user_id,
            goal_id=goal_id,
        )

        replayed = await self._recovery.replay(
            definition,
            goal_id=goal_id,
            execution_id=snapshot.execution_id,
            sequence=source_sequence,
            new_execution_id=replay_execution_id,
        )
        affected = self._downstream(definition, failed_step_id)
        affected.add(failed_step_id)
        for step_id in affected:
            self._reset_state(replayed.steps[step_id])
        replayed.status = WorkflowStatus.RUNNING
        replayed.metadata = {
            **replayed.metadata,
            "dead_letter_replay": {
                "record_key": record_key,
                "source_execution_id": snapshot.execution_id,
                "source_sequence": source_sequence,
                "failed_step_id": failed_step_id,
                "reviewed_by": actor_id,
                "reason": reason,
                "replayed_at": self._clock.now().isoformat(),
            },
        }
        replayed = await self._recovery.save(
            definition,
            replayed,
            user_id=user_id,
            goal_id=goal_id,
        )
        await self._emit("workflow.dead_letter.replayed", replayed, record)
        return reviewed, replayed

    @staticmethod
    def occ_projection(snapshot: WorkflowExecutionSnapshot) -> tuple[dict[str, Any], ...]:
        records = WorkflowDeadLetterService._records(snapshot)
        return tuple(
            sorted(
                (dict(record) for record in records.values()),
                key=lambda item: (str(item.get("created_at", "")), str(item.get("key", ""))),
                reverse=True,
            )
        )

    @staticmethod
    def _records(snapshot: WorkflowExecutionSnapshot) -> dict[str, dict[str, Any]]:
        raw = snapshot.metadata.get("dead_letters", {})
        if not isinstance(raw, dict):
            raise ValueError("dead letter metadata must be an object")
        return {str(key): dict(value) for key, value in raw.items() if isinstance(value, dict)}

    @staticmethod
    def _require_pending(records: dict[str, dict[str, Any]], record_key: str) -> dict[str, Any]:
        try:
            record = records[record_key]
        except KeyError as exc:
            raise LookupError(f"dead letter record not found: {record_key}") from exc
        if record.get("status") != DeadLetterDisposition.PENDING.value:
            raise ValueError("dead letter record has already been reviewed")
        return record

    @staticmethod
    def _reset_state(state: Any) -> None:
        state.status = StepStatus.READY
        state.task_id = None
        state.output = None
        state.error = None
        state.error_type = None
        state.started_at = None
        state.completed_at = None
        state.next_retry_at = None
        state.retry_delay_seconds = None
        state.dead_letter_ready = False

    @staticmethod
    def _downstream(definition: WorkflowDefinition, root: str) -> set[str]:
        reverse: dict[str, set[str]] = {step.id: set() for step in definition.steps}
        for step in definition.steps:
            for dependency in step.depends_on:
                reverse[dependency].add(step.id)
        result: set[str] = set()
        frontier = list(reverse[root])
        while frontier:
            step_id = frontier.pop()
            if step_id in result:
                continue
            result.add(step_id)
            frontier.extend(reverse[step_id])
        return result

    async def _emit(
        self,
        event: str,
        snapshot: WorkflowExecutionSnapshot,
        record: dict[str, Any],
    ) -> None:
        await self._events.emit(
            {
                "event": event,
                "execution_id": snapshot.execution_id,
                "workflow_id": snapshot.workflow_id,
                "dead_letter_key": record.get("key"),
                "step_id": record.get("step_id"),
                "status": record.get("status"),
                "reviewed_by": record.get("reviewed_by"),
                "reason": record.get("reason"),
                "replay_execution_id": record.get("replay_execution_id"),
            }
        )
