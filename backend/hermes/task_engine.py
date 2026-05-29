"""
Hermes Task Engine
==================
State machine + CRUD for hermes_tasks, hermes_runs, hermes_logs, and agent dispatch.
All DB operations go through the Supabase service-role client (bypasses RLS).
"""
from __future__ import annotations

import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Valid task states and legal transitions
# ---------------------------------------------------------------------------
TASK_STATES = {
    "PENDING", "LOCKED", "RUNNING", "COMPLETED",
    "FAILED", "RETRY", "MANUAL_REVIEW", "ESCALATED", "PAUSED",
}

VALID_TRANSITIONS: dict[str, set[str]] = {
    "PENDING":       {"LOCKED", "PAUSED", "CANCELLED"},
    "LOCKED":        {"RUNNING", "PENDING", "FAILED"},
    "RUNNING":       {"COMPLETED", "FAILED", "PAUSED", "ESCALATED", "MANUAL_REVIEW"},
    "FAILED":        {"RETRY", "MANUAL_REVIEW", "ESCALATED"},
    "RETRY":         {"PENDING"},
    "PAUSED":        {"PENDING", "RUNNING"},
    "MANUAL_REVIEW": {"PENDING", "ESCALATED", "COMPLETED"},
    "ESCALATED":     {"MANUAL_REVIEW", "COMPLETED", "FAILED"},
    "COMPLETED":     set(),   # terminal
}

# ---------------------------------------------------------------------------
# Supabase REST client helpers
# ---------------------------------------------------------------------------

def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "")

def _service_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def _is_configured() -> bool:
    return bool(_supabase_url() and _service_key())

def _headers() -> dict[str, str]:
    return {
        "apikey": _service_key(),
        "Authorization": f"Bearer {_service_key()}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

async def _sb_get(table: str, params: dict[str, str]) -> list[dict]:
    if not _is_configured():
        return []
    url = f"{_supabase_url()}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers=_headers(), params=params)
        r.raise_for_status()
        return r.json()

async def _sb_post(table: str, payload: dict) -> dict:
    if not _is_configured():
        return {}
    url = f"{_supabase_url()}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, headers=_headers(), json=payload)
        r.raise_for_status()
        data = r.json()
        return data[0] if isinstance(data, list) and data else data

async def _sb_patch(table: str, row_id: str, payload: dict) -> dict:
    if not _is_configured():
        return {}
    url = f"{_supabase_url()}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            url,
            headers=_headers(),
            params={"id": f"eq.{row_id}"},
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        return data[0] if isinstance(data, list) and data else data

# ---------------------------------------------------------------------------
# Task CRUD
# ---------------------------------------------------------------------------

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
    """Create a new Hermes task in PENDING state."""
    payload: dict[str, Any] = {
        "title": title,
        "task_type": task_type,
        "status": "PENDING",
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
    )
    return task


async def get_task(task_id: str) -> dict | None:
    rows = await _sb_get("hermes_tasks", {"id": f"eq.{task_id}", "limit": "1"})
    return rows[0] if rows else None


async def list_tasks(
    status: str | None = None,
    agent_name: str | None = None,
    limit: int = 50,
) -> list[dict]:
    params: dict[str, str] = {
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if status:
        params["status"] = f"eq.{status}"
    if agent_name:
        params["agent_name"] = f"eq.{agent_name}"
    return await _sb_get("hermes_tasks", params)


async def transition_task(
    task_id: str,
    new_status: str,
    output_data: dict | None = None,
    error_message: str | None = None,
    agent_name: str | None = None,
) -> dict:
    """Apply a state transition with validation."""
    task = await get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    current = task["status"]
    allowed = VALID_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise ValueError(
            f"Invalid transition {current} → {new_status}. "
            f"Allowed: {sorted(allowed)}"
        )

    patch: dict[str, Any] = {"status": new_status}
    now = datetime.now(timezone.utc).isoformat()

    if new_status == "RUNNING":
        patch["started_at"] = now
        if agent_name:
            patch["agent_name"] = agent_name
            patch["assigned_at"] = now
    elif new_status in {"COMPLETED", "FAILED"}:
        patch["completed_at"] = now
    if output_data:
        patch["output_data"] = output_data
    if error_message:
        patch["error_message"] = error_message
    if new_status == "RETRY":
        patch["retry_count"] = task.get("retry_count", 0) + 1
        patch["status"] = "PENDING"  # RETRY resets to PENDING

    updated = await _sb_patch("hermes_tasks", task_id, patch)
    await log_event(
        task_id=task_id,
        event=f"task.{new_status.lower()}",
        message=f"Task transitioned {current} → {new_status}",
        agent_name=agent_name or task.get("agent_name"),
        data={"previous_status": current, "new_status": new_status},
    )
    return updated


# ---------------------------------------------------------------------------
# Run tracking
# ---------------------------------------------------------------------------

async def start_run(task_id: str, agent_name: str, run_number: int = 1) -> dict:
    payload = {
        "task_id": task_id,
        "agent_name": agent_name,
        "run_number": run_number,
        "status": "RUNNING",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    return await _sb_post("hermes_runs", payload)


async def finish_run(
    run_id: str,
    status: str,
    output_snapshot: dict | None = None,
    error_detail: str | None = None,
    tokens_used: int | None = None,
    cost_usd: float | None = None,
    duration_ms: int | None = None,
) -> dict:
    patch: dict[str, Any] = {
        "status": status,
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


# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------

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
    """Synchronous wrapper for log_event (creates a new event loop if needed)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(log_event(event, message, **kwargs))
        else:
            loop.run_until_complete(log_event(event, message, **kwargs))
    except Exception as exc:  # noqa: BLE001
        logger.warning("fire_log_event failed: %s", exc)


# ---------------------------------------------------------------------------
# Agent dispatch
# ---------------------------------------------------------------------------

AGENT_HIERARCHY = {
    "HERMES":   {"role": "orchestrator", "children": ["TARS", "ION", "SAPPHIRE", "GUARDIAN"]},
    "TARS":     {"role": "execution",    "children": []},
    "ION":      {"role": "analytics",    "children": []},
    "SAPPHIRE": {"role": "memory",       "children": []},
    "GUARDIAN": {"role": "safety",       "children": []},
}


async def dispatch_to_agent(
    agent_name: str,
    task_id: str,
    input_data: dict | None = None,
) -> dict:
    """
    Dispatch a task to a named agent.
    Currently enqueues via Supabase Edge Function `enqueue-task`.
    Falls back to a local no-op if Supabase is not configured.
    """
    if agent_name not in AGENT_HIERARCHY:
        raise ValueError(f"Unknown agent: {agent_name}. Valid: {list(AGENT_HIERARCHY)}")

    supabase_url = _supabase_url()
    webhook_secret = os.getenv("HERMES_WEBHOOK_SECRET", "")

    if not supabase_url or not webhook_secret:
        logger.warning("Hermes dispatch: Supabase not configured — skipping enqueue")
        return {"status": "skipped", "reason": "not_configured"}

    enqueue_url = f"{supabase_url}/functions/v1/enqueue-task"
    payload = {
        "task_id": task_id,
        "agent": agent_name,
        "input": input_data or {},
    }

    import hmac, hashlib, json
    body = json.dumps(payload, separators=(",", ":"))
    sig = hmac.new(webhook_secret.encode(), body.encode(), hashlib.sha256).hexdigest()

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            enqueue_url,
            content=body,
            headers={
                "Content-Type": "application/json",
                "x-hermes-signature": sig,
                "Authorization": f"Bearer {_service_key()}",
            },
        )
        r.raise_for_status()
        return r.json()
