"""Shared HNF -> Hermes submission service used by REST, MCP, and Telegram."""
from __future__ import annotations

from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.task_engine import create_task, get_task_by_correlation_id, log_event, transition_task
from backend.hnf.registry import get_workflow


async def submit_hnf_workflow(
    *,
    workflow_name: str,
    request_id: str,
    actor_id: str,
    actor_type: str,
    context: dict[str, Any] | None = None,
    persona_id: str | None = None,
    budget_max_usd: float | None = None,
    priority: int | None = None,
    transport: str = "api",
) -> tuple[dict[str, Any], bool]:
    workflow = get_workflow(workflow_name)
    correlation_id = f"hnfportal:{request_id.strip()}"
    existing = await get_task_by_correlation_id(correlation_id)
    if existing:
        return existing, True

    input_data: dict[str, Any] = {
        "tenant_id": "hnfportal",
        "surface": workflow.surface,
        "workflow": workflow.name,
        "actor": {"id": actor_id, "type": actor_type},
        "transport": transport,
        "context": context or {},
        "requires_approval": workflow.requires_approval,
    }
    if persona_id:
        input_data["persona_id"] = persona_id
    if budget_max_usd is not None:
        input_data["budget"] = {"max_usd": budget_max_usd}

    task = await create_task(
        title=f"HNF workflow: {workflow.name}",
        task_type=workflow.name,
        description=workflow.description,
        agent_name="HERMES",
        input_data=input_data,
        priority=priority or workflow.default_priority,
        source=f"hnfportal:{transport}",
        correlation_id=correlation_id,
        initial_status=TaskStatus.PAUSED if workflow.requires_approval else TaskStatus.PENDING,
    )
    await log_event(
        event="hnf.workflow.accepted",
        message=f"Accepted {workflow.name} from HNFPORTAL.one",
        task_id=task.get("id"),
        agent_name="HERMES",
        data={
            "tenant_id": "hnfportal",
            "surface": workflow.surface,
            "workflow": workflow.name,
            "transport": transport,
            "requires_approval": workflow.requires_approval,
        },
        correlation_id=correlation_id,
    )
    return task, False


async def get_hnf_request(request_id: str) -> dict[str, Any] | None:
    return await get_task_by_correlation_id(f"hnfportal:{request_id.strip()}")


async def decide_hnf_request(*, request_id: str, approved: bool, actor_id: str, note: str | None = None) -> dict[str, Any]:
    task = await get_hnf_request(request_id)
    if not task:
        raise KeyError(f"unknown HNF request: {request_id}")
    current = str(task.get("status") or "")
    if current != TaskStatus.PAUSED.value:
        raise ValueError(f"HNF request is not awaiting approval (status={current})")
    target = TaskStatus.PENDING if approved else TaskStatus.CANCELLED
    updated = await transition_task(
        str(task["id"]),
        target,
        output_data={"approval": {"approved": approved, "actor_id": actor_id, "note": note}} if not approved else None,
        error_message=None if approved else (note or "HNF workflow rejected"),
        agent_name="HERMES",
        expected_status=TaskStatus.PAUSED,
    )
    await log_event(
        event="hnf.workflow.approved" if approved else "hnf.workflow.rejected",
        message=f"HNF workflow {'approved' if approved else 'rejected'} by {actor_id}",
        task_id=str(task["id"]),
        agent_name="HERMES",
        data={"tenant_id": "hnfportal", "actor_id": actor_id, "note": note},
        correlation_id=str(task.get("correlation_id") or ""),
    )
    return updated
