"""FastAPI bridge for the Hermes Intelligence Fabric.

All routes require a valid Supabase admin/operator JWT. Supabase REST and
HMAC-signed enqueue operations are delegated to shared Hermes adapters.
"""
from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.hermes.infrastructure import (
    HermesDispatchClient,
    HermesInfrastructureConfig,
    SupabaseRestClient,
    sign_payload,
)
from backend.occ_operator.occ_logger import log_error

router = APIRouter(prefix="/api/hermes", tags=["hermes"])

_CONFIG = HermesInfrastructureConfig.from_env()
_SUPABASE = SupabaseRestClient(_CONFIG)
_DISPATCH = HermesDispatchClient(_CONFIG)


def _supabase_url() -> str:
    return _CONFIG.supabase_url


def _service_role_key() -> str:
    return _CONFIG.service_role_key


def _hermes_webhook_secret() -> str:
    return _CONFIG.webhook_secret


def _hermes_internal_api_key() -> str:
    return _CONFIG.internal_api_key


def _is_configured() -> bool:
    return _SUPABASE.configured


def _sb_headers() -> dict[str, str]:
    return _SUPABASE.headers()


def _sign_payload(body: str, secret: str) -> str:
    return sign_payload(body, secret)


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


def _require_supabase() -> None:
    if not _SUPABASE.configured:
        raise HTTPException(status_code=503, detail="Supabase not configured.")


async def _get_rows(table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    _require_supabase()
    try:
        return await _SUPABASE.get(table, params)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc


@router.get("/health")
async def hermes_health(_: OCCPrincipal = Depends(require_occ_access)):
    configured = _SUPABASE.configured
    return {
        "status": "ok" if configured else "degraded",
        "supabase": "configured" if configured else "not_configured",
        "hermes_webhook_secret": "set" if _CONFIG.webhook_secret else "missing",
        "hermes_internal_api_key": "set" if _CONFIG.internal_api_key else "missing",
    }


@router.get("/goals")
async def list_goals(limit: int = 50, _: OCCPrincipal = Depends(require_occ_access)):
    return await _get_rows("hermes_goals", {"order": "created_at.desc", "limit": limit})


@router.post("/goals", status_code=201)
async def create_goal(body: CreateGoalRequest, principal: OCCPrincipal = Depends(require_occ_access)):
    _require_supabase()
    payload = {"title": body.title, "description": body.description, "metadata": body.metadata}
    try:
        result = await _SUPABASE.post("hermes_goals", payload)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return [result] if result else []


@router.get("/tasks")
async def list_tasks(
    goal_id: str | None = None,
    status_filter: str | None = None,
    limit: int = 100,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    return await _get_rows("hermes_tasks", params)


@router.post("/enqueue")
async def enqueue_task(
    body: EnqueueTaskRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    if not _CONFIG.webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="HERMES_WEBHOOK_SECRET is not configured. Add it to Railway environment variables.",
        )
    if not _CONFIG.supabase_url:
        raise HTTPException(status_code=503, detail="SUPABASE_URL is not configured.")

    payload = {
        "kind": body.kind,
        "goal_id": body.goal_id,
        "title": body.title,
        "description": body.description,
        "task_payload": body.task_payload,
        "max_depth": body.max_depth,
    }
    try:
        return await _DISPATCH.enqueue(payload, signature_header="X-Hermes-Signature")
    except httpx.HTTPStatusError as exc:
        await log_error(
            error_type="hermes_enqueue_failed",
            message=exc.response.text,
            severity="error",
            service="hermes",
            endpoint="/api/hermes/enqueue",
            user_id=principal.user_id,
            metadata={"kind": body.kind, "goal_id": body.goal_id, "status_code": exc.response.status_code},
        )
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc.response.text}") from exc
    except httpx.RequestError as exc:
        await log_error(
            error_type="hermes_enqueue_network_error",
            message=str(exc),
            severity="error",
            service="hermes",
            endpoint="/api/hermes/enqueue",
            user_id=principal.user_id,
        )
        raise HTTPException(status_code=502, detail=f"Network error reaching Supabase Edge Function: {exc}") from exc


@router.get("/interrupts")
async def list_interrupts(
    status_filter: str = "pending",
    limit: int = 50,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if status_filter:
        params["status"] = f"eq.{status_filter}"
    return await _get_rows("hermes_interrupts", params)


@router.patch("/interrupts/{interrupt_id}")
async def resolve_interrupt(
    interrupt_id: str,
    resolution: dict[str, str],
    principal: OCCPrincipal = Depends(require_occ_access),
):
    new_status = resolution.get("status")
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")
    _require_supabase()
    try:
        await _SUPABASE.patch(
            "hermes_interrupts",
            interrupt_id,
            {
                "status": new_status,
                "response": resolution.get("response"),
                "resolved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase error: {exc.response.text}") from exc
    return {"status": "updated", "interrupt_id": interrupt_id, "resolution": new_status}


@router.get("/checkpoints")
async def list_checkpoints(
    goal_id: str | None = None,
    limit: int = 30,
    _: OCCPrincipal = Depends(require_occ_access),
):
    params: dict[str, Any] = {"order": "created_at.desc", "limit": limit}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    return await _get_rows("hermes_checkpoints", params)


@router.get("/stats")
async def hermes_stats(_: OCCPrincipal = Depends(require_occ_access)):
    if not _SUPABASE.configured:
        return {"error": "Supabase not configured", "configured": False}

    total_goals = await _SUPABASE.count("hermes_goals")
    active_goals = await _SUPABASE.count("hermes_goals", {"status": "eq.active"})
    total_tasks = await _SUPABASE.count("hermes_tasks")
    pending_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.pending"})
    processing_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.processing"})
    failed_tasks = await _SUPABASE.count("hermes_tasks", {"status": "eq.failed"})
    pending_interrupts = await _SUPABASE.count("hermes_interrupts", {"status": "eq.pending"})

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
