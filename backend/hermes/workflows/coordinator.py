"""Restart-safe coordination of ready Hermes workflow steps."""

from __future__ import annotations

from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.ports import AgentDispatcher, Clock, EventSink, TaskRepository
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import (
    StepStatus,
    WorkflowDefinition,
    WorkflowExecutionSnapshot,
)
from backend.hermes.workflows.reconciliation import dispatch_idempotency_key


class WorkflowExecutionCoordinator:
    """Bind, checkpoint, and dispatch ready workflow steps through stable ports.

    The coordinator provides restart-safe, effectively-once dispatch when the
    downstream dispatcher honors the supplied idempotency key. A transactional
    outbox is intentionally deferred until the platform requires strict
    cross-system exactly-once delivery.
    """

    def __init__(
        self,
        *,
        repository: TaskRepository,
        dispatcher: AgentDispatcher,
        recovery: WorkflowRecoveryService,
        clock: Clock,
        event_sink: EventSink,
    ) -> None:
        self._repository = repository
        self._dispatcher = dispatcher
        self._recovery = recovery
        self._clock = clock
        self._events = event_sink
        self._engine = WorkflowEngine(clock)

    async def dispatch_ready(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
        max_steps: int | None = None,
        selected_step_ids: tuple[str, ...] | None = None,
    ) -> WorkflowExecutionSnapshot:
        """Dispatch ready steps in deterministic definition order.

        ``selected_step_ids`` lets the capacity-aware scheduler delegate a
        pre-planned batch without duplicating binding or dispatch behavior.
        """
        self._validate_definition(definition, snapshot)
        updated = snapshot.model_copy(deep=True)
        ready_ids = self._engine.ready_step_ids(definition, updated)
        if selected_step_ids is not None:
            unknown = set(selected_step_ids) - set(ready_ids)
            if unknown:
                raise ValueError(f"selected steps are not ready: {sorted(unknown)}")
            selected = set(selected_step_ids)
            ready_ids = tuple(step_id for step_id in ready_ids if step_id in selected)
        if max_steps is not None:
            if max_steps < 1:
                raise ValueError("max_steps must be at least 1")
            ready_ids = ready_ids[:max_steps]

        definitions = {step.id: step for step in definition.steps}
        for step_id in ready_ids:
            step = definitions[step_id]
            state = updated.steps[step_id]
            attempt = state.attempt + 1
            idempotency_key = dispatch_idempotency_key(
                execution_id=updated.execution_id,
                step_id=step_id,
                attempt=attempt,
            )
            task = await self._find_task(idempotency_key)
            if task is None:
                task = await self._create_task(
                    definition=definition,
                    snapshot=updated,
                    step_id=step_id,
                    agent_name=step.agent,
                    input_data=step.input,
                    idempotency_key=idempotency_key,
                )

            updated = self._engine.mark_running(
                updated,
                step_id,
                task_id=str(task["id"]),
            )
            updated = await self._recovery.save(
                definition,
                updated,
                user_id=user_id,
                goal_id=goal_id,
            )

            task_status = TaskStatus(task["status"])
            if task_status is TaskStatus.PENDING:
                updated = await self._dispatch_bound_step(
                    definition=definition,
                    snapshot=updated,
                    step_id=step_id,
                    task=task,
                    agent_name=step.agent,
                    input_data=step.input,
                    idempotency_key=idempotency_key,
                    user_id=user_id,
                    goal_id=goal_id,
                )
            else:
                state = updated.steps[step_id]
                state.status = StepStatus.WAITING
                state.error = None
                updated.updated_at = self._clock.now().isoformat()
                updated = await self._recovery.save(
                    definition,
                    updated,
                    user_id=user_id,
                    goal_id=goal_id,
                )
                await self._emit(
                    "workflow.step.dispatch.reused",
                    updated,
                    step_id,
                    idempotency_key,
                )

        return updated

    async def _dispatch_bound_step(
        self,
        *,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        task: dict[str, Any],
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str,
        user_id: str,
        goal_id: str,
    ) -> WorkflowExecutionSnapshot:
        updated = snapshot.model_copy(deep=True)
        payload = {
            **input_data,
            "_hermes": {
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "workflow_version": updated.workflow_version,
                "step_id": step_id,
                "attempt": updated.steps[step_id].attempt,
                "idempotency_key": idempotency_key,
            },
        }
        try:
            dispatch_result = await self._dispatcher.dispatch(
                task_id=str(task["id"]),
                agent_name=agent_name,
                input_data=payload,
                idempotency_key=idempotency_key,
            )
        except Exception as exc:
            now = self._clock.now().isoformat()
            await self._repository.update_row(
                "hermes_tasks",
                str(task["id"]),
                {
                    "status": TaskStatus.FAILED.value,
                    "error_message": f"dispatch failed: {exc}",
                    "completed_at": now,
                },
            )
            state = updated.steps[step_id]
            state.status = StepStatus.WAITING
            state.error = f"dispatch failed: {exc}"
            updated.updated_at = now
            updated = await self._recovery.save(
                definition,
                updated,
                user_id=user_id,
                goal_id=goal_id,
            )
            await self._emit(
                "workflow.step.dispatch.failed",
                updated,
                step_id,
                idempotency_key,
            )
            return updated

        now = self._clock.now().isoformat()
        await self._repository.update_row(
            "hermes_tasks",
            str(task["id"]),
            {
                "status": TaskStatus.LOCKED.value,
                "assigned_at": now,
                "output_data": {"dispatch_result": dispatch_result},
            },
        )
        state = updated.steps[step_id]
        state.status = StepStatus.WAITING
        state.error = None
        updated.updated_at = now
        updated = await self._recovery.save(
            definition,
            updated,
            user_id=user_id,
            goal_id=goal_id,
        )
        await self._emit(
            "workflow.step.dispatched",
            updated,
            step_id,
            idempotency_key,
        )
        return updated

    async def _find_task(self, idempotency_key: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_tasks",
            {"correlation_id": f"eq.{idempotency_key}", "limit": "1"},
        )
        return rows[0] if rows else None

    async def _create_task(
        self,
        *,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str,
    ) -> dict[str, Any]:
        return await self._repository.create_row(
            "hermes_tasks",
            {
                "title": f"{definition.id}:{step_id}",
                "description": f"Workflow step {step_id} for execution {snapshot.execution_id}",
                "task_type": "workflow_step",
                "status": TaskStatus.PENDING.value,
                "priority": 5,
                "source": "workflow",
                "retry_count": 0,
                "agent_name": agent_name,
                "input_data": input_data,
                "correlation_id": idempotency_key,
            },
        )

    async def _emit(
        self,
        event: str,
        snapshot: WorkflowExecutionSnapshot,
        step_id: str,
        idempotency_key: str,
    ) -> None:
        state = snapshot.steps[step_id]
        await self._events.emit(
            {
                "event": event,
                "execution_id": snapshot.execution_id,
                "workflow_id": snapshot.workflow_id,
                "step_id": step_id,
                "task_id": state.task_id,
                "attempt": state.attempt,
                "idempotency_key": idempotency_key,
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
