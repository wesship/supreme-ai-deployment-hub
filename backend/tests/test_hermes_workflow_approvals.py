from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from backend.hermes.contracts import TaskStatus
from backend.hermes.testing import (
    FrozenClock,
    InMemoryCheckpointStore,
    InMemoryEventSink,
    InMemoryTaskRepository,
)
from backend.hermes.workflows import (
    ApprovalPolicy,
    StepStatus,
    WorkflowApprovalService,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowRecoveryService,
    WorkflowStatus,
    WorkflowStepDefinition,
    approval_request_key,
)


def run(coro):
    return asyncio.run(coro)


def build_runtime():
    clock = FrozenClock(datetime(2026, 7, 18, 4, 0, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    checkpoints = InMemoryCheckpointStore()
    events = InMemoryEventSink()
    recovery = WorkflowRecoveryService(store=checkpoints, clock=clock, event_sink=events)
    approvals = WorkflowApprovalService(
        repository=repository,
        recovery=recovery,
        clock=clock,
        event_sink=events,
    )
    return approvals, repository, checkpoints, events, clock


def workflow() -> WorkflowDefinition:
    return WorkflowDefinition(
        id="protected-launch",
        version="1.0.0",
        steps=(
            WorkflowStepDefinition(
                id="deploy",
                agent="TARS",
                input={"environment": "production"},
                requires_approval=True,
            ),
        ),
    )


def test_request_creates_one_guard_interrupt_and_checkpointed_pause() -> None:
    service, repository, checkpoints, events, clock = build_runtime()
    definition = workflow()
    snapshot = WorkflowEngine(clock).create_execution(definition, execution_id="exec-approve-1")

    first = run(
        service.request_pending(
            definition,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
            policies={"deploy": ApprovalPolicy(prompt="Approve production deployment?", ttl_seconds=600)},
        )
    )
    second = run(
        service.request_pending(
            definition,
            first,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert first.status is WorkflowStatus.PAUSED
    assert first.steps["deploy"].status is StepStatus.WAITING
    assert first.steps["deploy"].task_id is None
    assert len(repository.tables["hermes_tasks"]) == 1
    assert repository.tables["hermes_tasks"][0]["task_type"] == "approval_guard"
    assert repository.tables["hermes_tasks"][0]["status"] == TaskStatus.MANUAL_REVIEW.value
    assert len(repository.tables["hermes_interrupts"]) == 1
    assert "Approve production deployment?" in repository.tables["hermes_interrupts"][0]["prompt"]
    assert len(checkpoints.records) == 2
    assert second.metadata["approvals"]["deploy"]["request_key"] == approval_request_key(
        execution_id="exec-approve-1",
        step_id="deploy",
    )
    assert [event["event"] for event in events.events].count("workflow.approval.requested") == 2


def test_approved_interrupt_resumes_step_without_creating_execution_task() -> None:
    service, repository, _, events, clock = build_runtime()
    definition = workflow()
    snapshot = WorkflowEngine(clock).create_execution(definition, execution_id="exec-approve-2")
    pending = run(
        service.request_pending(
            definition,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
        )
    )
    interrupt = repository.tables["hermes_interrupts"][0]
    run(
        repository.update_row(
            "hermes_interrupts",
            interrupt["id"],
            {
                "status": "approved",
                "response": "approved by operator",
                "resolved_at": clock.current.isoformat(),
            },
        )
    )

    approved = run(
        service.reconcile(
            definition,
            pending,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert approved.status is WorkflowStatus.RUNNING
    assert approved.steps["deploy"].status is StepStatus.READY
    assert approved.steps["deploy"].task_id is None
    assert len(repository.tables["hermes_tasks"]) == 1
    assert repository.tables["hermes_tasks"][0]["status"] == TaskStatus.COMPLETED.value
    assert approved.metadata["approvals"]["deploy"]["status"] == "approved"
    assert any(event["event"] == "workflow.approval.approved" for event in events.events)


def test_rejected_interrupt_cancels_workflow_and_guard() -> None:
    service, repository, _, _, clock = build_runtime()
    definition = workflow()
    snapshot = WorkflowEngine(clock).create_execution(definition, execution_id="exec-reject")
    pending = run(
        service.request_pending(
            definition,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
        )
    )
    interrupt = repository.tables["hermes_interrupts"][0]
    run(repository.update_row("hermes_interrupts", interrupt["id"], {"status": "rejected"}))

    rejected = run(
        service.reconcile(
            definition,
            pending,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    assert rejected.status is WorkflowStatus.CANCELLED
    assert rejected.steps["deploy"].status is StepStatus.CANCELLED
    assert rejected.steps["deploy"].error == "approval rejected"
    assert repository.tables["hermes_tasks"][0]["status"] == TaskStatus.CANCELLED.value


def test_expired_interrupt_fails_closed() -> None:
    service, repository, _, events, clock = build_runtime()
    definition = workflow()
    snapshot = WorkflowEngine(clock).create_execution(definition, execution_id="exec-expire")
    pending = run(
        service.request_pending(
            definition,
            snapshot,
            user_id="user-1",
            goal_id="goal-1",
            policies={"deploy": ApprovalPolicy(ttl_seconds=60)},
        )
    )
    clock.current = clock.current + timedelta(seconds=61)

    expired = run(
        service.reconcile(
            definition,
            pending,
            user_id="user-1",
            goal_id="goal-1",
        )
    )

    interrupt = repository.tables["hermes_interrupts"][0]
    assert interrupt["status"] == "expired"
    assert expired.status is WorkflowStatus.CANCELLED
    assert expired.steps["deploy"].status is StepStatus.CANCELLED
    assert expired.steps["deploy"].error == "approval expired"
    assert any(event["event"] == "workflow.approval.expired" for event in events.events)
