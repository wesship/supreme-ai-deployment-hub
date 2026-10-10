"""Checkpoint persistence, recovery, and deterministic replay for Hermes workflows."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from backend.hermes.ports import CheckpointStore, Clock, EventSink
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)


class CheckpointEnvelope(BaseModel):
    """Versioned and integrity-protected checkpoint payload."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = "1.0"
    execution_id: str
    workflow_id: str
    workflow_version: str
    sequence: int = Field(ge=1)
    saved_at: str
    snapshot: dict[str, Any]
    checksum: str

    @classmethod
    def build(
        cls,
        snapshot: WorkflowExecutionSnapshot,
        *,
        saved_at: str,
    ) -> "CheckpointEnvelope":
        payload = snapshot.model_dump(mode="json")
        return cls(
            execution_id=snapshot.execution_id,
            workflow_id=snapshot.workflow_id,
            workflow_version=snapshot.workflow_version,
            sequence=snapshot.checkpoint_sequence,
            saved_at=saved_at,
            snapshot=payload,
            checksum=_checksum(payload),
        )

    def validated_snapshot(self) -> WorkflowExecutionSnapshot:
        if _checksum(self.snapshot) != self.checksum:
            raise ValueError("checkpoint checksum mismatch")
        snapshot = WorkflowExecutionSnapshot.model_validate(self.snapshot)
        if snapshot.execution_id != self.execution_id:
            raise ValueError("checkpoint execution id mismatch")
        if snapshot.workflow_id != self.workflow_id:
            raise ValueError("checkpoint workflow id mismatch")
        if snapshot.workflow_version != self.workflow_version:
            raise ValueError("checkpoint workflow version mismatch")
        if snapshot.checkpoint_sequence != self.sequence:
            raise ValueError("checkpoint sequence mismatch")
        return snapshot


class WorkflowRecoveryService:
    """Coordinates checkpoint persistence, safe restart recovery, and replay."""

    def __init__(
        self,
        *,
        store: CheckpointStore,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._store = store
        self._clock = clock
        self._events = event_sink
        self._engine = WorkflowEngine(clock)

    async def save(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        self._validate_definition(definition, snapshot)
        checkpointed = self._engine.checkpoint(snapshot)
        envelope = CheckpointEnvelope.build(
            checkpointed,
            saved_at=self._clock.now().isoformat(),
        )
        await self._store.save(
            user_id=user_id,
            goal_id=goal_id,
            execution_id=checkpointed.execution_id,
            sequence=checkpointed.checkpoint_sequence,
            envelope=envelope.model_dump(mode="json"),
        )
        await self._events.emit(
            {
                "event": "workflow.checkpoint.saved",
                "execution_id": checkpointed.execution_id,
                "workflow_id": checkpointed.workflow_id,
                "sequence": checkpointed.checkpoint_sequence,
            }
        )
        return checkpointed

    async def recover_latest(
        self,
        definition: WorkflowDefinition,
        *,
        goal_id: str,
        execution_id: str,
    ) -> WorkflowExecutionSnapshot:
        raw = await self._store.latest(goal_id=goal_id, execution_id=execution_id)
        if raw is None:
            raise LookupError(f"no checkpoint found for workflow execution {execution_id}")
        recovered = self._recover(definition, raw)
        await self._events.emit(
            {
                "event": "workflow.recovered",
                "execution_id": recovered.execution_id,
                "workflow_id": recovered.workflow_id,
                "sequence": recovered.checkpoint_sequence,
            }
        )
        return recovered

    async def replay(
        self,
        definition: WorkflowDefinition,
        *,
        goal_id: str,
        execution_id: str,
        sequence: int,
        new_execution_id: str | None = None,
    ) -> WorkflowExecutionSnapshot:
        raw = await self._store.get(
            goal_id=goal_id,
            execution_id=execution_id,
            sequence=sequence,
        )
        if raw is None:
            raise LookupError(
                f"checkpoint {sequence} not found for workflow execution {execution_id}"
            )
        source = self._recover(definition, raw)
        now = self._clock.now().isoformat()
        replayed = source.model_copy(deep=True)
        replayed.execution_id = new_execution_id or str(uuid4())
        replayed.created_at = now
        replayed.updated_at = now
        replayed.checkpoint_sequence = 0
        replayed.metadata = {
            **replayed.metadata,
            "replay_of_execution_id": execution_id,
            "replay_of_sequence": sequence,
        }
        await self._events.emit(
            {
                "event": "workflow.replayed",
                "execution_id": replayed.execution_id,
                "source_execution_id": execution_id,
                "source_sequence": sequence,
            }
        )
        return replayed

    def _recover(
        self,
        definition: WorkflowDefinition,
        raw: dict[str, Any],
    ) -> WorkflowExecutionSnapshot:
        envelope = CheckpointEnvelope.model_validate(raw)
        snapshot = envelope.validated_snapshot()
        self._validate_definition(definition, snapshot)

        recovered = snapshot.model_copy(deep=True)
        for state in recovered.steps.values():
            if state.status is not StepStatus.RUNNING:
                continue
            if state.task_id:
                state.status = StepStatus.WAITING
                state.error = "recovery requires task reconciliation"
            else:
                state.status = StepStatus.READY
                state.error = "recovered before task dispatch"
        if recovered.status is WorkflowStatus.RUNNING:
            recovered = self._engine.refresh_ready_steps(definition, recovered)
        recovered.updated_at = self._clock.now().isoformat()
        return recovered

    @staticmethod
    def _validate_definition(
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
    ) -> None:
        if snapshot.workflow_id != definition.id:
            raise ValueError("workflow definition id does not match checkpoint")
        if snapshot.workflow_version != definition.version:
            raise ValueError("workflow definition version does not match checkpoint")
        if set(snapshot.steps) != {step.id for step in definition.steps}:
            raise ValueError("workflow definition steps do not match checkpoint")


def _checksum(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
