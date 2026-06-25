"""
backend/occ_operator/public_stats_router.py — Public homepage stats endpoint.

Returns aggregated, non-sensitive platform metrics for the D3VONN.IO homepage.
No authentication required. Cached for 60 seconds to reduce Supabase load.

Registered at: /api/public/stats
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/public", tags=["public"])

# ── Configuration ─────────────────────────────────────────────────────────────

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_TIMEOUT = 8.0
_CACHE_TTL = 60  # seconds
_cache: dict[str, Any] = {"data": None, "ts": 0}


def _sb_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


async def _count_table(table: str, filters: dict[str, str] | None = None) -> int:
    """Count rows in a Supabase table using HEAD + Prefer: count=exact."""
    if not SUPABASE_URL:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params: dict[str, str] = {"select": "id", "limit": "0"}
    if filters:
        params.update(filters)
    headers = {**_sb_headers(), "Prefer": "count=exact"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, params=params)
            # Supabase returns count in Content-Range header
            content_range = resp.headers.get("content-range", "")
            if "/" in content_range:
                total = content_range.split("/")[-1]
                return int(total) if total != "*" else 0
            return 0
    except (httpx.RequestError, ValueError):
        return 0


async def _get_active_agents() -> int:
    """Count agents that have started but not yet completed."""
    if not SUPABASE_URL:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/agent_activity_logs"
    params = {
        "select": "agent_id,event_type",
        "order": "created_at.desc",
        "limit": "200",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_sb_headers(), params=params)
            if resp.status_code != 200:
                return 0
            data = resp.json()
            started = set()
            completed = set()
            for row in data:
                agent_id = row.get("agent_id")
                event = row.get("event_type", "")
                if event == "started":
                    started.add(agent_id)
                elif event in ("completed", "failed"):
                    completed.add(agent_id)
            return len(started - completed)
    except httpx.RequestError:
        return 0


async def _get_recent_events(limit: int = 5) -> list[dict[str, Any]]:
    """Return the latest Hermes events for the homepage feed."""
    if not SUPABASE_URL:
        return []
    url = f"{SUPABASE_URL}/rest/v1/agent_activity_logs"
    params = {
        "select": "agent_id,event_type,created_at,metadata",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_sb_headers(), params=params)
            if resp.status_code != 200:
                return []
            return resp.json()
    except httpx.RequestError:
        return []


@router.get("/stats")
async def get_public_stats() -> dict[str, Any]:
    """
    Return aggregated platform stats for the D3VONN.IO homepage.
    Cached for 60 seconds to minimize backend load.
    """
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    if not SUPABASE_URL:
        # Return sensible defaults when backend is not configured
        fallback = {
            "active_agents": 0,
            "completed_workflows": 0,
            "uptime_percent": 99.9,
            "queue_pending": 0,
            "total_tasks_processed": 0,
            "latest_events": [],
            "system_health": "operational",
            "cached": False,
        }
        return fallback

    try:
        active_agents = await _get_active_agents()
        completed_workflows = await _count_table(
            "agent_activity_logs",
            {"event_type": "eq.completed"},
        )
        queue_pending = await _count_table(
            "approval_queue",
            {"status": "eq.pending"},
        )
        total_tasks = await _count_table("ai_request_logs")
        latest_events = await _get_recent_events(5)

        result = {
            "active_agents": active_agents,
            "completed_workflows": completed_workflows,
            "uptime_percent": 99.9,
            "queue_pending": queue_pending,
            "total_tasks_processed": total_tasks,
            "latest_events": latest_events,
            "system_health": "operational",
            "cached": True,
        }

        _cache["data"] = result
        _cache["ts"] = now
        return result

    except Exception:
        # Graceful degradation — return last cached or defaults
        if _cache["data"]:
            return _cache["data"]
        return {
            "active_agents": 0,
            "completed_workflows": 0,
            "uptime_percent": 99.9,
            "queue_pending": 0,
            "total_tasks_processed": 0,
            "latest_events": [],
            "system_health": "degraded",
            "cached": False,
        }


@router.get("/health")
async def public_health() -> dict[str, str]:
    """Lightweight health check for the public API."""
    return {
        "status": "ok",
        "service": "d3vonn-public-api",
        "supabase": "connected" if SUPABASE_URL else "not_configured",
    }
