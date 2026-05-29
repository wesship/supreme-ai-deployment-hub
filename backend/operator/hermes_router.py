"""
backend/operator/hermes_router.py — FastAPI bridge for Hermes Intelligence Fabric.

Provides authenticated REST endpoints that proxy to the Supabase Hermes tables
and the Supabase Edge Function `enqueue-task` webhook.

All routes require a valid Supabase admin/operator JWT (same guard as OCC).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.operator.occ_logger import log_error

router = APIRouter(prefix="/api/hermes", tags=["hermes"])

# ── Configuration ─────────────────────────────────────────────────────────────

def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _service_role_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _hermes_webhook_secret() -> str:
    return os.getenv("HERMES_WEBHOOK_SECRET", "")


def _hermes_internal_api_key() -> str:
    return os.getenv("HERMES_INTERNAL_API_KEY", "")


def _is_configured() -> bool:
    return bool(_supabase_url() and _service_role_key())


_TIMEOUT = 10.0


def _sb_headers() -> dict[str, str]:
    key = _service_role_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


# ── HMAC helper ───────────────────────────────────────────────────────────────

def _sign_payload(body: str, secret: str) -> str:
    """Generate HMAC-SHA256 hex signature for the enqueue-task webhook."""
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


# ── Pydantic models ───────────────────────────────────────────────────────────

class EnqueueTaskRequest(BaseModel):
    kind: str = Field(..., description="Task kind: tars.plan | tars.summarize | tars.followup | tars.research")
    goal_id: str = Field(..., description="UUID of the parent hermes_goals row")
    title: str | None = None
    description: str | None = None
    task_payload: dict[str, Any] = Field(default_factory=dict)
    max_depth: int = Field(default=3, ge=1, le=10)


class CreateGoalRequest(BaseModel):
    title: str
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def hermes_health(_: OCCPrincipal = Depends(require_occ_access)):
    """Check Hermes bridge connectivity."""
    configured = _is_configured()
    webhook_secret_set = bool(_hermes_webhook_secret())
    internal_key_set = bool(_hermes_internal_api_key())
    return {
        "status": "ok" if configured else "degraded",
        "supabase": "configured" if configured else "not_configured",
        "hermes_webhook_secret": "set" if webhook_secret_set else "missing",
        "hermes_internal_api_key": "set" if internal_key_set else "missing",
    }


# ── Goals ─────────────────────────────────────────────────────────────────────

@router.get("/goals")
async def list_goals(
    limit: int = 50,
    _: OCCPrincipal = Depends(require_occ_access),
):
    """List Hermes goals ordered by most recent."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_supabase_url()}/rest/v1/hermes_goals",
            headers=_sb_headers(),
            params={"order": "created_at.desc", "limit": limit},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return resp.json()


@router.post("/goals", status_code=201)
async def create_goal(
    body: CreateGoalRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """Create a new Hermes goal."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    payload = {"title": body.title, "description": body.description, "metadata": body.metadata}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_supabase_url()}/rest/v1/hermes_goals",
            headers={**_sb_headers(), "Prefer": "return=representation"},
            json=payload,
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return resp.json()


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def list_tasks(
    goal_id: str | None = None,
    status_filter: str | None = None,
    limit: int = 100,
    _: OCCPrincipal = Depends(require_occ_access),
):
    """List Hermes tasks with optional goal_id and status filters."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_supabase_url()}/rest/v1/hermes_tasks",
            headers=_sb_headers(),
            params=params,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return resp.json()


# ── Enqueue task via webhook ──────────────────────────────────────────────────

@router.post("/enqueue")
async def enqueue_task(
    body: EnqueueTaskRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """
    Enqueue a Hermes task via the HMAC-signed enqueue-task Edge Function.

    Requires HERMES_WEBHOOK_SECRET to be set in Railway environment variables.
    """
    secret = _hermes_webhook_secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="HERMES_WEBHOOK_SECRET is not configured. Add it to Railway environment variables.",
        )
    if not _supabase_url():
        raise HTTPException(status_code=503, detail="SUPABASE_URL is not configured.")

    payload_dict = {
        "kind": body.kind,
        "goal_id": body.goal_id,
        "title": body.title,
        "description": body.description,
        "task_payload": body.task_payload,
        "max_depth": body.max_depth,
    }
    body_text = json.dumps(payload_dict, separators=(",", ":"))
    signature = _sign_payload(body_text, secret)

    enqueue_url = f"{_supabase_url()}/functions/v1/enqueue-task"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                enqueue_url,
                content=body_text,
                headers={
                    "Content-Type": "application/json",
                    "X-Hermes-Signature": signature,
                },
            )
        if resp.status_code not in (200, 201):
            await log_error(
                error_type="hermes_enqueue_failed",
                message=resp.text,
                severity="error",
                service="hermes",
                endpoint="/api/hermes/enqueue",
                user_id=principal.user_id,
                metadata={"kind": body.kind, "goal_id": body.goal_id, "status_code": resp.status_code},
            )
            raise HTTPException(status_code=502, detail=f"Enqueue failed: {resp.text}")
        return resp.json()
    except httpx.RequestError as exc:
        await log_error(
            error_type="hermes_enqueue_network_error",
            message=str(exc),
            severity="error",
            service="hermes",
            endpoint="/api/hermes/enqueue",
            user_id=principal.user_id,
        )
        raise HTTPException(status_code=502, detail=f"Network error reaching Supabase Edge Function: {exc}")


# ── Interrupts ────────────────────────────────────────────────────────────────

@router.get("/interrupts")
async def list_interrupts(
    status_filter: str = "pending",
    limit: int = 50,
    _: OCCPrincipal = Depends(require_occ_access),
):
    """List Hermes interrupts (human-in-the-loop pause points)."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_supabase_url()}/rest/v1/hermes_interrupts",
            headers=_sb_headers(),
            params=params,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return resp.json()


@router.patch("/interrupts/{interrupt_id}")
async def resolve_interrupt(
    interrupt_id: str,
    resolution: dict[str, str],
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """Approve or reject a Hermes interrupt (status: approved | rejected)."""
    new_status = resolution.get("status")
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.patch(
            f"{_supabase_url()}/rest/v1/hermes_interrupts",
            headers={**_sb_headers(), "Prefer": "return=representation"},
            params={"id": f"eq.{interrupt_id}"},
            json={
                "status": new_status,
                "response": resolution.get("response"),
                "resolved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return {"status": "updated", "interrupt_id": interrupt_id, "resolution": new_status}


# ── Checkpoints ───────────────────────────────────────────────────────────────

@router.get("/checkpoints")
async def list_checkpoints(
    goal_id: str | None = None,
    limit: int = 30,
    _: OCCPrincipal = Depends(require_occ_access),
):
    """List Hermes checkpoints (durable task output snapshots)."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Supabase not configured.")
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            f"{_supabase_url()}/rest/v1/hermes_checkpoints",
            headers=_sb_headers(),
            params=params,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Supabase error: {resp.text}")
    return resp.json()


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def hermes_stats(_: OCCPrincipal = Depends(require_occ_access)):
    """Return aggregate counts across all Hermes tables."""
    if not _is_configured():
        return {"error": "Supabase not configured", "configured": False}

    async def _count(table: str, filters: dict[str, str] | None = None) -> int:
        params: dict[str, Any] = {"select": "id"}
        if filters:
            params.update(filters)
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{_supabase_url()}/rest/v1/{table}",
                headers={**_sb_headers(), "Prefer": "count=exact"},
                params=params,
            )
        if resp.status_code != 200:
            return -1
        content_range = resp.headers.get("content-range", "")
        try:
            return int(content_range.split("/")[-1])
        except (ValueError, IndexError):
            return len(resp.json())

    total_goals = await _count("hermes_goals")
    active_goals = await _count("hermes_goals", {"status": "eq.active"})
    total_tasks = await _count("hermes_tasks")
    pending_tasks = await _count("hermes_tasks", {"status": "eq.pending"})
    processing_tasks = await _count("hermes_tasks", {"status": "eq.processing"})
    failed_tasks = await _count("hermes_tasks", {"status": "eq.failed"})
    pending_interrupts = await _count("hermes_interrupts", {"status": "eq.pending"})

    return {
        "configured": True,
        "goals": {"total": total_goals, "active": active_goals},
        "tasks": {
            "total": total_tasks,
            "pending": pending_tasks,
            "processing": processing_tasks,
            "failed": failed_tasks,
        },
        "interrupts": {"pending": pending_interrupts},
    }
