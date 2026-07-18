"""Durable, fail-closed human approval gates for Hermes workflows."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from backend.hermes.contracts import TaskStatus
from backend.hermes.ports import Clock, EventSink, TaskRepository
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
    WorkflowStatus,
)


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ApprovalPolicy(BaseModel):
    """Workflow-step approval policy."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    prompt: str = Field(default="Approve protected workflow step?", min_length=1, max_length=2_000)
    ttl_seconds: int = Field(default=86_400, ge=60, le=2_592_000)


def approval_request_key(*, execution_id: str, step_id: str) -> str:
    """Return a stable identity for one execution-step approval request."""
    return hashlib.sha256(f"{execution_id}:{step_id}:approval".encode()).hexdigest()


class WorkflowApprovalService:
    """Create, checkpoint, and reconcile protected workflow approvals.

    The existing ``hermes_interrupts`` table requires a task reference, so the
    service creates an ``approval_guard`` task. It is never dispatched to an
    agent; the protected execution task is created only after approval.
    """

    def __init__(
        self,
        *,
        repository: TaskRepository,
        recovery: WorkflowRecoveryService,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._repository = repository
        self._recovery = recovery
        self._clock = clock
        self._events = event_sink
        self._engine = WorkflowEngine(clock)

    async def request_pending(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
        policies: dict[str, ApprovalPolicy] | None = None,
    ) -> WorkflowExecutionSnapshot:
        """Create or reuse interrupts for approval-blocked workflow steps."""
        self._validate_definition(definition, snapshot)
        updated = snapshot.model_copy(deep=True)
        policy_map = policies or {}
        approvals = self._approval_metadata(updated)

        for step in definition.steps:
            state = updated.steps[step.id]
            if not step.requires_approval or state.status is not StepStatus.WAITING:
                continue
            existing = approvals.get(step.id)
            if existing and existing.get("status") == ApprovalStatus.APPROVED.value:
                state.status = StepStatus.READY
                continue

            policy = policy_map.get(step.id, ApprovalPolicy())
            request_key = approval_request_key(
                execution_id=updated.execution_id,
                step_id=step.id,
            )
            guard = await self._find_guard(request_key)
            if guard is None:
                guard = await self._repository.create_row(
                    "hermes_tasks",
                    {
                        "user_id": user_id,
                        "goal_id": goal_id,
                        "title": f"Approval guard: {definition.id}:{step.id}",
                        "description": f"Human approval guard for execution {updated.execution_id}",
                        "task_type": "approval_guard",
                        "kind": "approval_guard",
                        "status": TaskStatus.MANUAL_REVIEW.value,
                        "priority": 1,
                        "source": "workflow_approval",
                        "retry_count": 0,
                        "agent_name": "GUARDIAN",
                        "input_data": {"workflow_id": definition.id, "step_id": step.id},
                        "payload": {"workflow_id": definition.id, "step_id": step.id},
                        "correlation_id": request_key,
                    },
                )

            interrupt = await self._find_interrupt(str(guard["id"]))
            expires_at = (self._now() + timedelta(seconds=policy.ttl_seconds)).isoformat()
            if interrupt is None:
                marker = f"[hermes-approval:{request_key}]"
                interrupt = await self._repository.create_row(
                    "hermes_interrupts",
                    {
                        "user_id": user_id,
                        "task_id": str(guard["id"]),
                        "goal_id": goal_id,
                        "prompt": f"{marker} {policy.prompt}",
                        "status": ApprovalStatus.PENDING.value,
                    },
                )

            approvals[step.id] = {
                "request_key": request_key,
                "interrupt_id": str(interrupt["id"]),
                "guard_task_id": str(guard["id"]),
                "status": str(interrupt.get("status", ApprovalStatus.PENDING.value)),
                "expires_at": existing.get("expires_at") if existing else expires_at,
            }
            state.error = "awaiting human approval"
            await self._emit("workflow.approval.requested", updated, step.id, approvals[step.id])

        if any(item.get("status") == ApprovalStatus.PENDING.value for item in approvals.values()):
            if updated.status in {WorkflowStatus.PENDING, WorkflowStatus.RUNNING}:
                updated = self._engine.pause(updated)
            updated.metadata["approvals"] = approvals
            updated = await self._recovery.save(
                definition,
                updated,
                user_id=user_id,
                goal_id=goal_id,
            )
        return updated

    async def reconcile(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        """Apply approved, rejected, or expired interrupt decisions."""
        self._validate_definition(definition, snapshot)
        updated = snapshot.model_copy(deep=True)
        approvals = self._approval_metadata(updated)
        pending_remains = False

        for step_id, approval in approvals.items():
            interrupt_id = approval.get("interrupt_id")
            if not interrupt_id:
                continue
            rows = await self._repository.list_rows(
                "hermes_interrupts",
                {"id": f"eq.{interrupt_id}", "limit": "1"},
            )
            if not rows:
                pending_remains = True
                continue

            interrupt = rows[0]
            status = ApprovalStatus(interrupt.get("status", ApprovalStatus.PENDING.value))
            if status is ApprovalStatus.PENDING and self._is_expired(approval.get("expires_at")):
                status = ApprovalStatus.EXPIRED
                await self._repository.update_row(
                    "hermes_interrupts",
                    str(interrupt_id),
                    {
                        "status": status.value,
                        "response": self._decision_payload(status, "Approval expired", None),
                        "resolved_at": self._clock.now().isoformat(),
                    },
                )

            state = updated.steps[step_id]
            approval["status"] = status.value
            approval["response"] = interrupt.get("response")
            approval["resolved_at"] = interrupt.get("resolved_at")

            if status is ApprovalStatus.APPROVED:
                state.status = StepStatus.READY
                state.error = None
                await self._close_guard(approval, TaskStatus.COMPLETED, None)
                await self._emit("workflow.approval.approved", updated, step_id, approval)
            elif status in {ApprovalStatus.REJECTED, ApprovalStatus.EXPIRED}:
                state.status = StepStatus.CANCELLED
                state.error = "approval rejected" if status is ApprovalStatus.REJECTED else "approval expired"
                state.completed_at = self._clock.now().isoformat()
                updated.status = WorkflowStatus.CANCELLED
                await self._close_guard(approval, TaskStatus.CANCELLED, state.error)
                await self._emit(f"workflow.approval.{status.value}", updated, step_id, approval)
            else:
                pending_remains = True

        updated.metadata["approvals"] = approvals
        if updated.status is WorkflowStatus.PAUSED and not pending_remains:
            updated = self._engine.resume(definition, updated)
        updated.updated_at = self._clock.now().isoformat()
        return await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )

    async def _find_guard(self, request_key: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_tasks",
            {"correlation_id": f"eq.{request_key}", "limit": "1"},
        )
        return rows[0] if rows else None

    async def _find_interrupt(self, task_id: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_interrupts",
            {"task_id": f"eq.{task_id}", "limit": "1"},
        )
        return rows[0] if rows else None

    async def _close_guard(
        self,
        approval: dict[str, Any],
        status: TaskStatus,
        error: str | None,
    ) -> None:
        guard_id = approval.get("guard_task_id")
        if not guard_id:
            return
        patch: dict[str, Any] = {
            "status": status.value,
            "completed_at": self._clock.now().isoformat(),
        }
        if error:
            patch["error_message"] = error
        await self._repository.update_row("hermes_tasks", str(guard_id), patch)

    async def _emit(
        self,
        event: str,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        approval: dict[str, Any],
    ) -> None:
        await self._events.emit(
            {
                "event": event,
                "execution_id": snapshot.execution_id,
                "workflow_id": snapshot.workflow_id,
                "step_id": step_id,
                "interrupt_id": approval.get("interrupt_id"),
                "approval_key": approval.get("request_key"),
                "status": approval.get("status"),
            }
        )

    @staticmethod
    def _approval_metadata(snapshot: WorkflowExecutionSnapshot) -> dict[str, dict[str, Any]]:
        raw = snapshot.metadata.get("approvals", {})
        if not isinstance(raw, dict):
            raise ValueError("workflow approval metadata must be an object")
        return {str(key): dict(value) for key, value in raw.items() if isinstance(value, dict)}

    def _is_expired(self, expires_at: Any) -> bool:
        if not isinstance(expires_at, str):
            return False
        parsed = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return self._now() >= parsed

    def _now(self) -> datetime:
        current = self._clock.now()
        return current if current.tzinfo else current.replace(tzinfo=timezone.utc)

    @staticmethod
    def _decision_payload(status: ApprovalStatus, note: str | None, actor_id: str | None) -> str:
        return json.dumps(
            {"status": status.value, "note": note, "actor_id": actor_id},
            sort_keys=True,
            separators=(",", ":"),
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
