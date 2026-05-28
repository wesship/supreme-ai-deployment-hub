"""
backend/operator/occ_router.py — OCC Supabase data endpoints with JWT auth.

These endpoints proxy read-only queries to the Supabase OCC tables
(ai_request_logs, tool_call_logs, agent_activity_logs, error_logs,
approval_queue, user_plans, rag_documents) and are protected by
Supabase JWT + admin/operator role check.

Registered at: /api/occ/*
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

try:
    from backend.auth.supabase_jwt import OCCAccess, require_occ_access
except ImportError:  # pragma: no cover
    async def require_occ_access():  # type: ignore
        return None
    OCCAccess = Any  # type: ignore

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(
    prefix="/api/occ",
    tags=["occ"],
    dependencies=[Depends(require_occ_access)],
)


def _supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _not_configured() -> dict[str, Any]:
    return {
        "error": "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Railway.",
        "data": [],
    }


async def _query_table(
    table: str,
    select: str = "*",
    order: str = "created_at.desc",
    limit: int = 100,
    filters: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Generic Supabase REST query helper."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []

    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params: dict[str, str] = {
        "select": select,
        "order": order,
        "limit": str(limit),
    }
    if filters:
        params.update(filters)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_supabase_headers(), params=params)
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Supabase query failed for {table}: {resp.status_code} {resp.text[:200]}",
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot reach Supabase: {exc}",
        )


# ---------------------------------------------------------------------------
# OCC endpoints
# ---------------------------------------------------------------------------

@router.get("/ai-requests")
async def get_ai_request_logs(
    limit: int = Query(100, ge=1, le=500),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return recent AI request logs from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    data = await _query_table("ai_request_logs", limit=limit)
    return {"count": len(data), "data": data}


@router.get("/tool-calls")
async def get_tool_call_logs(
    limit: int = Query(100, ge=1, le=500),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return recent tool call logs from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    data = await _query_table("tool_call_logs", limit=limit)
    return {"count": len(data), "data": data}


@router.get("/agent-activity")
async def get_agent_activity_logs(
    limit: int = Query(100, ge=1, le=500),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return recent agent activity logs from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    data = await _query_table("agent_activity_logs", limit=limit)
    return {"count": len(data), "data": data}


@router.get("/errors")
async def get_error_logs(
    limit: int = Query(100, ge=1, le=500),
    unresolved_only: bool = Query(False),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return error logs from Supabase, optionally filtered to unresolved only."""
    if not SUPABASE_URL:
        return _not_configured()
    filters = {"resolved": "eq.false"} if unresolved_only else None
    data = await _query_table("error_logs", limit=limit, filters=filters)
    return {"count": len(data), "data": data}


@router.get("/approvals")
async def get_approval_queue(
    limit: int = Query(50, ge=1, le=200),
    pending_only: bool = Query(False),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return approval queue items from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    filters = {"status": "eq.pending"} if pending_only else None
    data = await _query_table("approval_queue", limit=limit, filters=filters)
    return {"count": len(data), "data": data}


@router.get("/user-plans")
async def get_user_plans(
    limit: int = Query(100, ge=1, le=500),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return user plan records from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    data = await _query_table("user_plans", limit=limit)
    return {"count": len(data), "data": data}


@router.get("/rag-documents")
async def get_rag_documents(
    limit: int = Query(100, ge=1, le=500),
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return RAG document records from Supabase."""
    if not SUPABASE_URL:
        return _not_configured()
    data = await _query_table("rag_documents", limit=limit)
    return {"count": len(data), "data": data}


@router.get("/stats")
async def get_occ_stats(
    _: OCCAccess = Depends(require_occ_access),
) -> dict[str, Any]:
    """Return aggregated OCC stats for the overview panel."""
    if not SUPABASE_URL:
        return _not_configured()

    ai_data, error_data, approval_data, rag_data = await _query_table("ai_request_logs", select="total_tokens,cost_usd,status", limit=1000), \
        await _query_table("error_logs", select="resolved", limit=500), \
        await _query_table("approval_queue", select="status", limit=200), \
        await _query_table("rag_documents", select="id", limit=500)

    total_tokens = sum(r.get("total_tokens") or 0 for r in ai_data)
    total_cost = sum(float(r.get("cost_usd") or 0) for r in ai_data)
    unresolved_errors = sum(1 for r in error_data if not r.get("resolved"))
    pending_approvals = sum(1 for r in approval_data if r.get("status") == "pending")

    return {
        "total_ai_requests": len(ai_data),
        "total_tokens_used": total_tokens,
        "total_cost_usd": round(total_cost, 6),
        "unresolved_errors": unresolved_errors,
        "pending_approvals": pending_approvals,
        "total_rag_documents": len(rag_data),
    }
