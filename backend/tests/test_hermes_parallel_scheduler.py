from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryCheckpointStore,
    InMemoryEventSink,
    InMemoryTaskRepository,
)
from backend.hermes.workflows import (
    SchedulerPolicy,
    StepStatus,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowExecutionCoordinator,
    WorkflowParallelScheduler,
    WorkflowRecoveryService,
    WorkflowStepDefinition,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    clock = FrozenClock(datetime(2026, 7, 18, 7, 0, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    dispatcher = InMemoryAgentDispatcher()
    checkpoints = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    recovery = WorkflowRecoveryService(store=checkpoints, clock=clock, event_sink=events)
    coordinator = WorkflowExecutionCoordinator(
        repository=repository,
        dispatcher=dispatcher,
        recovery=recovery,
        clock=clock,
        event_sink=events,
    )
    scheduler = WorkflowParallelScheduler(
        repository=repository,
        coordinator=coordinator,
        event_sink=events,
    )
    return scheduler, repository, dispatcher, checkpoints, events, clock


def definition() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="parallel-flow",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(id="a1", agent="TARS"),
            WorkflowStepDefinition(id="a2", agent="TARS"),
            WorkflowStepDefinition(id="b1", agent="ION"),
            WorkflowStepDefinition(id="b2", agent="ION"),
            WorkflowStepDefinition(id="c1", agent="SAPPHIRE"),
        ),
    )


def snapshot(defn: WorkflowDefinition, clock: FrozenClock):
    return WorkflowEngine(clock).create_execution(defn, execution_id="exec-parallel")


def test_plan_is_deterministic_and_fair_across_agents() -> None:
    scheduler, _, _, _, _, clock = build_runtime()
    defn = definition()
    plan = run(
        scheduler.plan(
            defn,
            snapshot(defn, clock),
            policy=SchedulerPolicy(global_limit=3, workflow_limit=3, default_agent_limit=2),
        )
    )
    assert plan.selected_step_ids == ("a1", "b1", "c1")
    assert plan.blocked_step_ids == ("a2", "b2")
    assert plan.ready_step_ids == ("a1", "a2", "b1", "b2", "c1")


def test_per_agent_limit_blocks_saturated_agent_but_uses_other_capacity() -> None:
    scheduler, repository, _, _, _, clock = build_runtime()
    repository.tables["hermes_tasks"] = [
        {"id": "active-tars", "status": "RUNNING", "agent_name": "TARS", "description": "other"}
    ]
    defn = definition()
    plan = run(
        scheduler.plan(
            defn,
            snapshot(defn, clock),
            policy=SchedulerPolicy(
                global_limit=5,
                workflow_limit=5,
                default_agent_limit=2,
                per_agent_limits={"TARS": 1},
            ),
        )
    )
    assert "a1" not in plan.selected_step_ids
    assert "a2" not in plan.selected_step_ids
    assert plan.selected_step_ids == ("b1", "c1", "b2")
    assert plan.blocked_step_ids == ("a1", "a2")


def test_global_saturation_emits_capacity_event_without_dispatch() -> None:
    scheduler, repository, dispatcher, checkpoints, events, clock = build_runtime()
    repository.tables["hermes_tasks"] = [
        {"id": "one", "status": "RUNNING", "agent_name": "TARS", "description": "other"},
        {"id": "two", "status": "LOCKED", "agent_name": "ION", "description": "other"},
    ]
    defn = definition()
    original = snapshot(defn, clock)
    updated, plan = run(
        scheduler.schedule(
            defn,
            original,
            user_id="user-1",
            goal_id="goal-1",
            policy=SchedulerPolicy(global_limit=2, workflow_limit=3),
        )
    )
    assert plan.selected_step_ids == ()
    assert dispatcher.calls == []
    assert checkpoints.records == []
    assert updated == original
    assert events.events[-1]["event"] == "workflow.scheduler.saturated"


def test_schedule_dispatches_selected_batch_through_existing_coordinator() -> None:
    scheduler, repository, dispatcher, checkpoints, events, clock = build_runtime()
    defn = definition()
    updated, plan = run(
        scheduler.schedule(
            defn,
            snapshot(defn, clock),
            user_id="user-1",
            goal_id="goal-1",
            policy=SchedulerPolicy(global_limit=2, workflow_limit=2, default_agent_limit=1),
        )
    )
    assert plan.selected_step_ids == ("a1", "b1")
    assert [call["agent"] for call in dispatcher.calls] == ["TARS", "ION"]
    assert updated.steps["a1"].status is StepStatus.WAITING
    assert updated.steps["b1"].status is StepStatus.WAITING
    assert updated.steps["a2"].status is StepStatus.READY
    assert len(repository.tables["hermes_tasks"]) == 2
    assert len(checkpoints.records) == 4
    assert events.events[-1]["event"] == "workflow.scheduler.dispatched"


def test_occ_projection_reports_capacity_and_queue_depth() -> None:
    scheduler, _, _, _, _, clock = build_runtime()
    defn = definition()
    plan = run(
        scheduler.plan(
            defn,
            snapshot(defn, clock),
            policy=SchedulerPolicy(global_limit=2, workflow_limit=2),
        )
    )
    projection = scheduler.occ_projection(plan)
    assert projection["ready_queue_depth"] == 5
    assert projection["scheduled_batch_size"] == 2
    assert projection["blocked_by_capacity"] == 3
