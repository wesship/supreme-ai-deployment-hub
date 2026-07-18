"""
Hermes Task Engine
==================
State machine + CRUD for hermes_tasks, hermes_runs, hermes_logs, and agent dispatch.
All DB operations go through the shared Supabase service-role adapter.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from backend.hermes.contracts import RunStatus, TASK_TRANSITIONS, TaskStatus, can_transition
from backend.hermes.infrastructure import (
    HermesDispatchClient,
    HermesInfrastructureConfig,
    SupabaseRestClient,
)
from backend.hermes.registry import BUILTIN_AGENT_REGISTRY

logger = logging.getLogger(__name__)

TASK_STATES = {status.value for status in TaskStatus}
VALID_TRANSITIONS: dict[str, set[str]] = {
    current.value: {target.value for target in targets}
    for current, targets in TASK_TRANSITIONS.items()
}
AGENT_HIERARCHY = BUILTIN_AGENT_REGISTRY.hierarchy()

_CONFIG = HermesInfrastructureConfig.from_env()
_SUPABASE = SupabaseRestClient(_CONFIG)
_DISPATCH = HermesDispatchClient(_CONFIG)


def _supabase_url() -> str:
    return _CONFIG.supabase_url


def _service_key() -> str:
    return _CONFIG.service_role_key


def _is_configured() -> bool:
    return _SUPABASE.configured


def _headers() -> dict[str, str]:
    return _SUPABASE.headers(return_representation=True)


async def _sb_get(table: str, params: dict[str, str]) -> list[dict]:
    return await _SUPABASE.get(table, params)


async def _sb_post(table: str, payload: dict) -> dict:
    return await _SUPABASE.post(table, payload)


async def _sb_patch(table: str, row_id: str, payload: dict) -> dict:
    return await _SUPABASE.patch(table, row_id, payload)


async def create_task(
    title: str,
    task_type: str = "generic",
    description: str | None = None,
    agent_name: str | None = None,
    input_data: dict | None = None,
    parent_task_id: str | None = None,
    priority: int = 5,
    source: str = "api",
    scheduled_at: str | None = None,
    deadline_at: str | None = None,
    correlation_id: str | None = None,
) -> dict:
    """Create a new Hermes task in the canonical pending state."""
    payload: dict[str, Any] = {
        "title": title,
        "task_type": task_type,
        "status": TaskStatus.PENDING.value,
        "priority": priority,
        "source": source,
        "retry_count": 0,
    }
    if description:
        payload["description"] = description
    if agent_name:
        payload["agent_name"] = agent_name
    if input_data:
        payload["input_data"] = input_data
    if parent_task_id:
        payload["parent_task_id"] = parent_task_id
    if scheduled_at:
        payload["scheduled_at"] = scheduled_at
    if deadline_at:
        payload["deadline_at"] = deadline_at
    if correlation_id:
        payload["correlation_id"] = correlation_id

    task = await _sb_post("hermes_tasks", payload)
    await log_event(
        task_id=task.get("id"),
        event="task.created",
        message=f"Task '{title}' created (type={task_type})",
        agent_name=agent_name,
        correlation_id=correlation_id,
    )
    return task


async def get_task(task_id: str) -> dict | None:
    rows = await _sb_get("hermes_tasks", {"id": f"eq.{task_id}", "limit": "1"})
    return rows[0] if rows else None


async def list_tasks(
    status: str | TaskStatus | None = None,
    agent_name: str | None = None,
    limit: int = 50,
) -> list[dict]:
    params: dict[str, str] = {"order": "created_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{TaskStatus(status).value}"
    if agent_name:
        params["agent_name"] = f"eq.{agent_name}"
    return await _sb_get("hermes_tasks", params)


async def transition_task(
    task_id: str,
    new_status: str | TaskStatus,
    output_data: dict | None = None,
    error_message: str | None = None,
    agent_name: str | None = None,
) -> dict:
    """Apply a canonical state transition while preserving legacy string inputs."""
    task = await get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    try:
        current_status = TaskStatus(task["status"])
        target_status = TaskStatus(new_status)
    except ValueError as exc:
        raise ValueError(f"Unknown Hermes task status: {exc}") from exc

    if not can_transition(current_status, target_status):
        allowed = sorted(status.value for status in TASK_TRANSITIONS[current_status])
        raise ValueError(
            f"Invalid transition {current_status.value} → {target_status.value}. Allowed: {allowed}"
        )

    persisted_status = target_status
    patch: dict[str, Any] = {"status": target_status.value}
    now = datetime.now(timezone.utc).isoformat()

    if target_status is TaskStatus.RUNNING:
        patch["started_at"] = now
        if agent_name:
            patch["agent_name"] = agent_name
            patch["assigned_at"] = now
    elif target_status in {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
        patch["completed_at"] = now
    if output_data:
        patch["output_data"] = output_data
    if error_message:
        patch["error_message"] = error_message
    if target_status is TaskStatus.RETRY:
        patch["retry_count"] = task.get("retry_count", 0) + 1
        persisted_status = TaskStatus.PENDING
        patch["status"] = persisted_status.value

    updated = await _sb_patch("hermes_tasks", task_id, patch)
    await log_event(
        task_id=task_id,
        event=f"task.{target_status.value.lower()}",
        message=f"Task transitioned {current_status.value} → {target_status.value}",
        agent_name=agent_name or task.get("agent_name"),
        data={
            "previous_status": current_status.value,
            "requested_status": target_status.value,
            "persisted_status": persisted_status.value,
        },
        correlation_id=task.get("correlation_id"),
    )
    return updated


async def start_run(task_id: str, agent_name: str, run_number: int = 1) -> dict:
    return await _sb_post(
        "hermes_runs",
        {
            "task_id": task_id,
            "agent_name": agent_name,
            "run_number": run_number,
            "status": RunStatus.RUNNING.value,
            "started_at": datetime.now(timezone.utc).isoformat(),
        },
    )


async def finish_run(
    run_id: str,
    status: str | RunStatus,
    output_snapshot: dict | None = None,
    error_detail: str | None = None,
    tokens_used: int | None = None,
    cost_usd: float | None = None,
    duration_ms: int | None = None,
) -> dict:
    run_status = RunStatus(status)
    if run_status not in {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}:
        raise ValueError(f"finish_run requires a terminal status, got {run_status.value}")
    patch: dict[str, Any] = {
        "status": run_status.value,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    if output_snapshot:
        patch["output_snapshot"] = output_snapshot
    if error_detail:
        patch["error_detail"] = error_detail
    if tokens_used is not None:
        patch["tokens_used"] = tokens_used
    if cost_usd is not None:
        patch["cost_usd"] = cost_usd
    if duration_ms is not None:
        patch["duration_ms"] = duration_ms
    return await _sb_patch("hermes_runs", run_id, patch)


async def log_event(
    event: str,
    message: str | None = None,
    task_id: str | None = None,
    run_id: str | None = None,
    agent_name: str | None = None,
    level: str = "info",
    data: dict | None = None,
    correlation_id: str | None = None,
) -> None:
    """Fire-and-forget structured log entry to hermes_logs."""
    if not _is_configured():
        logger.debug("[hermes_log] %s %s", event, message)
        return
    payload: dict[str, Any] = {"event": event, "level": level}
    if message:
        payload["message"] = message
    if task_id:
        payload["task_id"] = task_id
    if run_id:
        payload["run_id"] = run_id
    if agent_name:
        payload["agent_name"] = agent_name
    if data:
        payload["data"] = data
    if correlation_id:
        payload["correlation_id"] = correlation_id
    try:
        await _sb_post("hermes_logs", payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("hermes_log failed: %s", exc)


def fire_log_event(event: str, message: str | None = None, **kwargs) -> None:
    """Synchronous wrapper for log_event."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(log_event(event, message, **kwargs))
        else:
            loop.run_until_complete(log_event(event, message, **kwargs))
    except Exception as exc:  # noqa: BLE001
        logger.warning("fire_log_event failed: %s", exc)


async def dispatch_to_agent(
    agent_name: str,
    task_id: str,
    input_data: dict | None = None,
) -> dict:
    """Dispatch to a manifest-registered agent via the shared enqueue adapter."""
    agent_id = agent_name.strip().lower()
    try:
        manifest = BUILTIN_AGENT_REGISTRY.get(agent_id)
    except KeyError as exc:
        valid = [registered.name for registered in BUILTIN_AGENT_REGISTRY.list()]
        raise ValueError(f"Unknown agent: {agent_name}. Valid: {valid}") from exc
    if not manifest.enabled:
        raise ValueError(f"Agent is disabled: {manifest.name}")
    if not _DISPATCH.configured:
        logger.warning("Hermes dispatch: Supabase not configured — skipping enqueue")
    return await _DISPATCH.enqueue(
        {"task_id": task_id, "agent": manifest.name, "input": input_data or {}},
        include_service_authorization=True,
        signature_header="x-hermes-signature",
    )
