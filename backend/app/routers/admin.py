"""
Operator Command Center — Admin API Router
All routes require admin role (Supabase JWT role claim = 'admin').
"""
from __future__ import annotations

import os
import re
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..middleware.auth import get_current_user_id

router = APIRouter(prefix="/admin", tags=["admin"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Compile the allowed Supabase host pattern once at module load time.
# Only *.supabase.co and *.supabase.in domains are permitted.
_ALLOWED_HOST_RE = re.compile(
    r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$"
)


def _validated_supabase_base() -> str:
    """Return the validated Supabase base URL, raising 503 if misconfigured.

    This function pins the outbound HTTP requests to the operator-configured
    Supabase project host, preventing partial SSRF: even if SUPABASE_URL were
    tampered with at runtime, requests can only reach *.supabase.co or
    *.supabase.in origins.
    """
    if not SUPABASE_URL or not SERVICE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Admin backend not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        )
    parsed = urlparse(SUPABASE_URL)
    host = parsed.hostname or ""
    if parsed.scheme not in ("https",) or not _ALLOWED_HOST_RE.match(host):
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_URL must be an https://*.supabase.co or https://*.supabase.in URL",
        )
    # Return the scheme+host only — no path, no query, no fragment.
    return f"https://{host}"


def _supa_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def _rest_url(table: str, params: str = "") -> str:
    """Build a validated Supabase REST URL for *table*.

    The table name is restricted to alphanumeric + underscore characters so
    it cannot be used to inject path traversal sequences.
    """
    base = _validated_supabase_base()
    if not re.match(r"^[a-zA-Z0-9_]+$", table):
        raise HTTPException(status_code=400, detail=f"Invalid table name: {table!r}")
    path = f"/rest/v1/{table}"
    return f"{base}{path}?{params}" if params else f"{base}{path}"


def _auth_url(user_id: str) -> str:
    """Build a validated Supabase Auth admin URL for *user_id*.

    user_id is a UUID; restrict it to UUID characters only.
    """
    base = _validated_supabase_base()
    if not re.match(r"^[a-fA-F0-9\-]{36}$", user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    return f"{base}/auth/v1/admin/users/{user_id}"


async def _query(table: str, params: str = "") -> list:
    if not SUPABASE_URL or not SERVICE_KEY:
        return []
    url = _rest_url(table, params)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, headers=_supa_headers())
        if r.status_code != 200:
            return []
        return r.json()


# Set ALLOW_DEV_ADMIN_BYPASS=true ONLY in local dev; never in production.
_DEV_BYPASS = os.getenv("ALLOW_DEV_ADMIN_BYPASS", "false").lower() == "true"


async def _require_admin(user_id: str = Depends(get_current_user_id)) -> str:
    """Verify the caller has admin role via Supabase auth.users metadata."""
    if not SUPABASE_URL or not SERVICE_KEY:
        if _DEV_BYPASS:
            return user_id  # explicit dev-only bypass
        raise HTTPException(
            status_code=503,
            detail="Admin auth not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        )
    url = _auth_url(user_id)
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(url, headers=_supa_headers())
        if r.status_code != 200:
            raise HTTPException(status_code=403, detail="Admin access required")
        user_data = r.json()
        role = (user_data.get("app_metadata") or {}).get("role", "")
        if role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


# ─────────────────────────────────────────────────────────────
# Overview / Summary
# ─────────────────────────────────────────────────────────────

@router.get("/overview")
async def get_overview(_: str = Depends(_require_admin)):
    """High-level platform metrics for the dashboard overview card."""
    ai_logs    = await _query("ai_request_logs", "select=cost_usd,total_tokens,status&order=created_at.desc&limit=1000")
    tool_logs  = await _query("tool_call_logs",  "select=status&order=created_at.desc&limit=500")
    agent_logs = await _query("agent_activity_logs", "select=status&order=created_at.desc&limit=500")
    errors     = await _query("error_logs", "select=id,resolved&resolved=eq.false")
    approvals  = await _query("approval_queue", "select=id&status=eq.pending")
    plans      = await _query("user_plans", "select=plan,messages_used,tokens_used")

    total_cost   = sum(float(r.get("cost_usd", 0)) for r in ai_logs)
    total_tokens = sum(int(r.get("total_tokens", 0)) for r in ai_logs)
    ai_errors    = sum(1 for r in ai_logs if r.get("status") == "error")
    tool_errors  = sum(1 for r in tool_logs if r.get("status") == "error")

    plan_counts: dict = {}
    for p in plans:
        plan_counts[p["plan"]] = plan_counts.get(p["plan"], 0) + 1

    return {
        "ai_requests_total": len(ai_logs),
        "ai_cost_usd_total": round(total_cost, 4),
        "ai_tokens_total": total_tokens,
        "ai_error_count": ai_errors,
        "tool_calls_total": len(tool_logs),
        "tool_error_count": tool_errors,
        "agent_tasks_total": len(agent_logs),
        "open_errors": len(errors),
        "pending_approvals": len(approvals),
        "plan_distribution": plan_counts,
    }


# ─────────────────────────────────────────────────────────────
# AI Request Logs
# ─────────────────────────────────────────────────────────────

@router.get("/ai-logs")
async def get_ai_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    _: str = Depends(_require_admin),
):
    return await _query(
        "ai_request_logs",
        f"select=*&order=created_at.desc&limit={limit}&offset={offset}",
    )


@router.get("/ai-costs")
async def get_ai_costs(_: str = Depends(_require_admin)):
    """Aggregated cost by model and by day (last 30 days)."""
    rows = await _query(
        "ai_request_logs",
        "select=model,provider,cost_usd,total_tokens,created_at&order=created_at.desc&limit=5000",
    )
    by_model: dict = {}
    for r in rows:
        m = r["model"]
        by_model.setdefault(m, {"model": m, "requests": 0, "tokens": 0, "cost_usd": 0.0})
        by_model[m]["requests"] += 1
        by_model[m]["tokens"]   += r.get("total_tokens", 0)
        by_model[m]["cost_usd"] += float(r.get("cost_usd", 0))
    return {"by_model": list(by_model.values()), "raw_sample": rows[:20]}


# ─────────────────────────────────────────────────────────────
# Tool Call Logs
# ─────────────────────────────────────────────────────────────

@router.get("/tool-logs")
async def get_tool_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    _: str = Depends(_require_admin),
):
    return await _query(
        "tool_call_logs",
        f"select=*&order=created_at.desc&limit={limit}&offset={offset}",
    )


# ─────────────────────────────────────────────────────────────
# Agent Activity Logs
# ─────────────────────────────────────────────────────────────

@router.get("/agent-logs")
async def get_agent_logs(
    limit: int = Query(50, le=200),
    _: str = Depends(_require_admin),
):
    return await _query(
        "agent_activity_logs",
        f"select=*&order=created_at.desc&limit={limit}",
    )


# ─────────────────────────────────────────────────────────────
# RAG Document Manager
# ─────────────────────────────────────────────────────────────

@router.get("/rag-documents")
async def get_rag_documents(
    limit: int = Query(100, le=500),
    _: str = Depends(_require_admin),
):
    return await _query(
        "rag_documents",
        f"select=*&order=created_at.desc&limit={limit}",
    )


@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str, _: str = Depends(_require_admin)):
    if not SUPABASE_URL or not SERVICE_KEY:
        return {"deleted": False}
    url = _rest_url("rag_documents", f"id=eq.{doc_id}")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(url, headers=_supa_headers(), json={"status": "deleted"})
    return {"deleted": r.status_code in (200, 204)}


# ─────────────────────────────────────────────────────────────
# Approval Queue
# ─────────────────────────────────────────────────────────────

@router.get("/approvals")
async def get_approvals(
    status: str = Query("pending"),
    _: str = Depends(_require_admin),
):
    return await _query(
        "approval_queue",
        f"select=*&status=eq.{status}&order=requested_at.desc",
    )


@router.patch("/approvals/{approval_id}")
async def review_approval(
    approval_id: str,
    decision: str = Query(..., pattern="^(approved|rejected)$"),
    note: Optional[str] = Query(None),
    admin_id: str = Depends(_require_admin),
):
    if not SUPABASE_URL or not SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    url = _rest_url("approval_queue", f"id=eq.{approval_id}")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            url,
            headers=_supa_headers(),
            json={
                "status": decision,
                "reviewed_by": admin_id,
                "review_note": note,
                "reviewed_at": "now()",
            },
        )
    return {"updated": r.status_code in (200, 204), "decision": decision}


# ─────────────────────────────────────────────────────────────
# Error Logs
# ─────────────────────────────────────────────────────────────

@router.get("/errors")
async def get_errors(
    resolved: bool = Query(False),
    limit: int = Query(50, le=200),
    _: str = Depends(_require_admin),
):
    return await _query(
        "error_logs",
        f"select=*&resolved=eq.{str(resolved).lower()}&order=created_at.desc&limit={limit}",
    )


@router.patch("/errors/{error_id}/resolve")
async def resolve_error(error_id: str, _: str = Depends(_require_admin)):
    if not SUPABASE_URL or not SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    url = _rest_url("error_logs", f"id=eq.{error_id}")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(url, headers=_supa_headers(), json={"resolved": True})
    return {"resolved": r.status_code in (200, 204)}


# ─────────────────────────────────────────────────────────────
# User Plans
# ─────────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans(
    limit: int = Query(100, le=500),
    _: str = Depends(_require_admin),
):
    return await _query(
        "user_plans",
        f"select=*&order=updated_at.desc&limit={limit}",
    )


@router.patch("/plans/{user_id}")
async def update_user_plan(
    user_id: str,
    plan: str = Query(..., pattern="^(free|pro|business|enterprise)$"),
    _: str = Depends(_require_admin),
):
    LIMITS = {
        "free":       {"messages_limit": 50,    "uploads_limit": 5,   "tokens_limit": 100_000},
        "pro":        {"messages_limit": 500,   "uploads_limit": 50,  "tokens_limit": 1_000_000},
        "business":   {"messages_limit": 2000,  "uploads_limit": 200, "tokens_limit": 5_000_000},
        "enterprise": {"messages_limit": 99999, "uploads_limit": 9999,"tokens_limit": 99_999_999},
    }
    if not SUPABASE_URL or not SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    url = _rest_url("user_plans", f"user_id=eq.{user_id}")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            url,
            headers=_supa_headers(),
            json={"plan": plan, "updated_at": "now()", **LIMITS[plan]},
        )
    return {"updated": r.status_code in (200, 204), "plan": plan}
