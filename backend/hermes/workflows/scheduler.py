"""Deterministic capacity-aware parallel scheduling for Hermes workflows."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from backend.hermes.contracts import TaskStatus
from backend.hermes.ports import EventSink, TaskRepository
from backend.hermes.workflows.coordinator import WorkflowExecutionCoordinator
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import WorkflowDefinition, WorkflowExecutionSnapshot


ACTIVE_TASK_STATUSES = (
    TaskStatus.PENDING.value,
    TaskStatus.LOCKED.value,
    TaskStatus.RUNNING.value,
    TaskStatus.PAUSED.value,
    TaskStatus.MANUAL_REVIEW.value,
    TaskStatus.ESCALATED.value,
)


class SchedulerPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    global_limit: int = Field(default=8, ge=1, le=10_000)
    workflow_limit: int = Field(default=4, ge=1, le=1_000)
    per_agent_limits: dict[str, int] = Field(default_factory=dict)
    default_agent_limit: int = Field(default=2, ge=1, le=1_000)


class SchedulerPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    selected_step_ids: tuple[str, ...]
    ready_step_ids: tuple[str, ...]
    blocked_step_ids: tuple[str, ...]
    global_active: int
    workflow_active: int
    agent_active: dict[str, int]
    global_available: int
    workflow_available: int


class WorkflowParallelScheduler:
    """Plan and dispatch deterministic capacity-aware workflow batches."""

    def __init__(
        self,
        *,
        repository: TaskRepository,
        coordinator: WorkflowExecutionCoordinator,
        event_sink: EventSink,
    ) -> None:
        self._repository = repository
        self._coordinator = coordinator
        self._events = event_sink
        self._engine = WorkflowEngine(_NoopClock())

    async def plan(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        policy: SchedulerPolicy,
    ) -> SchedulerPlan:
        ready = tuple(self._engine.ready_step_ids(definition, snapshot))
        tasks = await self._repository.list_rows("hermes_tasks", {})
        active = [task for task in tasks if str(task.get("status")) in ACTIVE_TASK_STATUSES]
        global_active = len(active)
        workflow_active = sum(
            1
            for task in active
            if str(task.get("description", "")).endswith(snapshot.execution_id)
            or snapshot.execution_id in str(task.get("description", ""))
        )
        agent_active: dict[str, int] = defaultdict(int)
        for task in active:
            agent_active[str(task.get("agent_name", "")).upper()] += 1

        global_available = max(0, policy.global_limit - global_active)
        workflow_available = max(0, policy.workflow_limit - workflow_active)
        remaining = min(global_available, workflow_available)
        selected: list[str] = []
        blocked: list[str] = []
        definitions = {step.id: step for step in definition.steps}

        # Round-robin by agent while preserving first appearance and step order.
        queues: dict[str, list[str]] = defaultdict(list)
        agent_order: list[str] = []
        for step_id in ready:
            agent = definitions[step_id].agent.upper()
            if agent not in queues:
                agent_order.append(agent)
            queues[agent].append(step_id)

        while remaining > 0 and any(queues.values()):
            progress = False
            for agent in agent_order:
                queue = queues[agent]
                if not queue:
                    continue
                limit = policy.per_agent_limits.get(agent, policy.default_agent_limit)
                if agent_active.get(agent, 0) >= limit:
                    blocked.extend(queue)
                    queue.clear()
                    continue
                step_id = queue.pop(0)
                selected.append(step_id)
                agent_active[agent] = agent_active.get(agent, 0) + 1
                remaining -= 1
                progress = True
                if remaining == 0:
                    break
            if not progress:
                break

        for agent in agent_order:
            blocked.extend(queues[agent])

        return SchedulerPlan(
            selected_step_ids=tuple(selected),
            ready_step_ids=ready,
            blocked_step_ids=tuple(blocked),
            global_active=global_active,
            workflow_active=workflow_active,
            agent_active=dict(sorted(agent_active.items())),
            global_available=global_available,
            workflow_available=workflow_available,
        )

    async def schedule(
        self,
        definition: WorkflowDefinition,
        snapshot: WorkflowExecutionSnapshot,
        *,
        user_id: str,
        goal_id: str,
        policy: SchedulerPolicy,
    ) -> tuple[WorkflowExecutionSnapshot, SchedulerPlan]:
        plan = await self.plan(definition, snapshot, policy=policy)
        await self._events.emit(
            {
                "event": "workflow.scheduler.planned",
                "execution_id": snapshot.execution_id,
                "workflow_id": snapshot.workflow_id,
                "ready": list(plan.ready_step_ids),
                "selected": list(plan.selected_step_ids),
                "blocked": list(plan.blocked_step_ids),
                "global_active": plan.global_active,
                "workflow_active": plan.workflow_active,
                "global_available": plan.global_available,
                "workflow_available": plan.workflow_available,
                "agent_active": plan.agent_active,
            }
        )
        if not plan.selected_step_ids:
            await self._events.emit(
                {
                    "event": "workflow.scheduler.saturated",
                    "execution_id": snapshot.execution_id,
                    "workflow_id": snapshot.workflow_id,
                    "ready_count": len(plan.ready_step_ids),
                }
            )
            return snapshot.model_copy(deep=True), plan

        updated = await self._coordinator.dispatch_ready(
            definition,
            snapshot,
            user_id=user_id,
            goal_id=goal_id,
            selected_step_ids=plan.selected_step_ids,
        )
        await self._events.emit(
            {
                "event": "workflow.scheduler.dispatched",
                "execution_id": updated.execution_id,
                "workflow_id": updated.workflow_id,
                "batch_size": len(plan.selected_step_ids),
                "step_ids": list(plan.selected_step_ids),
            }
        )
        return updated, plan

    @staticmethod
    def occ_projection(plan: SchedulerPlan) -> dict[str, Any]:
        return {
            "ready_queue_depth": len(plan.ready_step_ids),
            "scheduled_batch_size": len(plan.selected_step_ids),
            "blocked_by_capacity": len(plan.blocked_step_ids),
            "global_active": plan.global_active,
            "workflow_active": plan.workflow_active,
            "global_available": plan.global_available,
            "workflow_available": plan.workflow_available,
            "agent_active": plan.agent_active,
        }


class _NoopClock:
    def now(self):  # pragma: no cover - scheduler only uses ready-step calculation
        raise RuntimeError("scheduler planning clock should not be used")
