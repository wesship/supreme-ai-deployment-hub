"""Shared HNF -> Hermes submission service used by REST, MCP, and Telegram."""
from __future__ import annotations

from typing import Any

from backend.hermes.task_engine import create_task, get_task_by_correlation_id, log_event
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
