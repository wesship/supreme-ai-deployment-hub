"""
Hermes Task Engine
==================
State machine + CRUD for hermes_tasks, hermes_runs, hermes_logs, and agent dispatch.

v0.18 "Judgment Release" compatibility layer:
- completion contracts with evidence-based verification
- model-council / Mixture-of-Agents metadata
- background subagent fan-out metadata
- journey / learn memory event helpers
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

HERMES_RELEASE_VERSION = os.getenv("HERMES_RELEASE_VERSION", "v2026.7.1")
HERMES_RELEASE_NAME = os.getenv("HERMES_RELEASE_NAME", "The Judgment Release")
COMPLETION_CONTRACTS_ENABLED = os.getenv("HERMES_COMPLETION_CONTRACTS_ENABLED", "true").lower() == "true"
BACKGROUND_SUBAGENTS_ENABLED = os.getenv("HERMES_BACKGROUND_SUBAGENTS_ENABLED", "true").lower() == "true"

DEFAULT_MOA_COUNCIL = [
    model.strip()
    for model in os.getenv(
        "HERMES_MOA_DEFAULT_COUNCIL",
        "openai:gpt-5,anthropic:claude-opus-4.7,openrouter:deepseek,google:gemini",
    ).split(",")
    if model.strip()
]

# ---------------------------------------------------------------------------
# Valid task states and legal transitions
# ---------------------------------------------------------------------------
TASK_STATES = {
    "PENDING", "LOCKED", "RUNNING", "COMPLETED",
    "FAILED", "RETRY", "MANUAL_REVIEW", "ESCALATED", "PAUSED", "CANCELLED",
}

VALID_TRANSITIONS: dict[str, set[str]] = {
    "PENDING":       {"LOCKED", "PAUSED", "CANCELLED"},
    "LOCKED":        {"RUNNING", "PENDING", "FAILED", "CANCELLED"},
    "RUNNING":       {"COMPLETED", "FAILED", "PAUSED", "ESCALATED", "MANUAL_REVIEW", "CANCELLED"},
    "FAILED":        {"RETRY", "MANUAL_REVIEW", "ESCALATED"},
    "RETRY":         {"PENDING"},
    "PAUSED":        {"PENDING", "RUNNING", "CANCELLED"},
    "MANUAL_REVIEW": {"PENDING", "ESCALATED", "COMPLETED", "FAILED"},
    "ESCALATED":     {"MANUAL_REVIEW", "COMPLETED", "FAILED"},
    "CANCELLED":     set(),
    "COMPLETED":     set(),
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

def _normalize_completion_contract(contract: dict | None) -> dict | None:
    if not contract:
        return None
    normalized = dict(contract)
    normalized.setdefault("version", "v0.18")
    normalized.setdefault("mode", "evidence_required")
    normalized.setdefault("required_evidence", [])
    normalized.setdefault("required_checks", [])
    normalized.setdefault("manual_review_on_failure", True)
    return normalized

def _extract_dotted(data: dict, dotted_key: str) -> Any:
    cursor: Any = data
    for part in dotted_key.split("."):
        if not isinstance(cursor, dict) or part not in cursor:
            return None
        cursor = cursor[part]
    return cursor

def get_runtime_capabilities() -> dict:
    """Expose the Hermes v0.18 feature flags used by D3VONN.IO."""
    return {
        "release_version": HERMES_RELEASE_VERSION,
        "release_name": HERMES_RELEASE_NAME,
        "features": {
            "mixture_of_agents": True,
            "completion_contracts": COMPLETION_CONTRACTS_ENABLED,
            "evidence_verification": True,
            "learn_command_compatible": True,
            "journey_memory_events": True,
            "background_subagents": BACKGROUND_SUBAGENTS_ENABLED,
        },
        "default_model_council": DEFAULT_MOA_COUNCIL,
    }

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
    completion_contract: dict | None = None,
    verification_strategy: str = "evidence_required",
    model_council: list[str] | None = None,
    use_background_subagents: bool = False,
) -> dict:
    """Create a new Hermes task in PENDING state."""
    payload: dict[str, Any] = {
        "title": title,
        "task_type": task_type,
        "status": "PENDING",
        "priority": priority,
        "source": source,
        "retry_count": 0,
        "verification_strategy": verification_strategy,
        "hermes_release": HERMES_RELEASE_VERSION,
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
    if completion_contract:
        payload["completion_contract"] = _normalize_completion_contract(completion_contract)
    if model_council:
        payload["model_council"] = model_council
    if use_background_subagents:
        payload["background_subagents_enabled"] = BACKGROUND_SUBAGENTS_ENABLED

    task = await _sb_post("hermes_tasks", payload)
    await log_event(
        task_id=task.get("id"),
        event="task.created",
        message=f"Task '{title}' created (type={task_type}, hermes={HERMES_RELEASE_VERSION})",
        agent_name=agent_name,
        data={"completion_contract": bool(completion_contract), "model_council": model_council or []},
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


async def verify_completion_contract(task: dict, evidence: dict | None = None) -> dict:
    """
    Validate a v0.18-style completion contract before a task can become COMPLETED.
    Contract shape:
      {
        "required_evidence": ["tests.passed", "backend.health_http_200"],
        "required_checks": [{"name": "deploy", "status": "passed"}],
        "min_confidence": 0.80,
        "manual_review_on_failure": true
      }
    Evidence is merged from explicit evidence plus task.output_data.
    """
    contract = _normalize_completion_contract(task.get("completion_contract"))
    if not contract or not COMPLETION_CONTRACTS_ENABLED:
        return {"verified": True, "reason": "no_contract_or_disabled", "missing": [], "failed_checks": []}

    merged_evidence: dict[str, Any] = {}
    if isinstance(task.get("output_data"), dict):
        merged_evidence.update(task["output_data"])
    if evidence:
        merged_evidence.update(evidence)

    missing = []
    for key in contract.get("required_evidence", []):
        value = _extract_dotted(merged_evidence, str(key))
        if value in (None, False, "", [], {}):
            missing.append(str(key))

    failed_checks = []
    for check in contract.get("required_checks", []):
        if not isinstance(check, dict):
            continue
        name = str(check.get("name", "unnamed_check"))
        status = str(check.get("status", "")).lower()
        if status not in {"pass", "passed", "ok", "success", "true"}:
            failed_checks.append(name)

    confidence = merged_evidence.get("confidence")
    min_confidence = contract.get("min_confidence")
    if min_confidence is not None and confidence is not None:
        try:
            if float(confidence) < float(min_confidence):
                failed_checks.append(f"confidence_below_{min_confidence}")
        except (TypeError, ValueError):
            failed_checks.append("confidence_invalid")

    verified = not missing and not failed_checks
    return {
        "verified": verified,
        "release_version": HERMES_RELEASE_VERSION,
        "strategy": contract.get("mode", "evidence_required"),
        "missing": missing,
        "failed_checks": failed_checks,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def transition_task(
    task_id: str,
    new_status: str,
    output_data: dict | None = None,
    error_message: str | None = None,
    agent_name: str | None = None,
    verification_evidence: dict | None = None,
) -> dict:
    """Apply a state transition with validation and v0.18 completion-contract enforcement."""
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

    task_for_verification = dict(task)
    if output_data:
        existing_output = task_for_verification.get("output_data") or {}
        if isinstance(existing_output, dict):
            merged_output = {**existing_output, **output_data}
        else:
            merged_output = output_data
        task_for_verification["output_data"] = merged_output

    if new_status == "COMPLETED":
        verification = await verify_completion_contract(task_for_verification, verification_evidence)
        patch["verification_result"] = verification
        if not verification.get("verified"):
            new_status = "MANUAL_REVIEW"
            patch["status"] = "MANUAL_REVIEW"
            patch["error_message"] = "Completion contract failed; routed to MANUAL_REVIEW."
            await log_event(
                task_id=task_id,
                event="task.completion_contract_failed",
                message="Hermes v0.18 completion contract blocked COMPLETED transition.",
                level="warn",
                agent_name=agent_name or task.get("agent_name"),
                data=verification,
            )

    if new_status == "RUNNING":
        patch["started_at"] = now
        if agent_name:
            patch["agent_name"] = agent_name
            patch["assigned_at"] = now
    elif new_status in {"COMPLETED", "FAILED", "CANCELLED"}:
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
        data={"previous_status": current, "new_status": new_status, "release_version": HERMES_RELEASE_VERSION},
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
# Structured logging / journey learning
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


async def record_learning(
    title: str,
    content: str,
    source_url: str | None = None,
    source_task_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Persist a /learn-compatible memory entry for the Hermes journey view."""
    payload: dict[str, Any] = {
        "agent_name": "HERMES",
        "memory_type": "context",
        "key": f"learn:{title.lower().replace(' ', '-')}",
        "content": content,
        "importance": 8,
        "metadata": {
            "release_version": HERMES_RELEASE_VERSION,
            "journey_visible": True,
            "source_url": source_url,
            **(metadata or {}),
        },
    }
    if source_task_id:
        payload["source_task_id"] = source_task_id
    memory = await _sb_post("hermes_memory", payload)
    await log_event(
        task_id=source_task_id,
        event="journey.learned",
        message=f"Hermes learned workflow: {title}",
        agent_name="HERMES",
        data=payload["metadata"],
    )
    return memory


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
    "HERMES":   {"role": "orchestrator", "children": ["TARS", "ION", "SAPPHIRE", "GUARDIAN", "COUNCIL"]},
    "COUNCIL":  {"role": "mixture_of_agents", "children": DEFAULT_MOA_COUNCIL},
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
        "release_version": HERMES_RELEASE_VERSION,
        "background_subagents_enabled": BACKGROUND_SUBAGENTS_ENABLED,
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
