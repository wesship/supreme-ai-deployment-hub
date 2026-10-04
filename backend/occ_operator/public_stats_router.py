"""Public aggregate telemetry. Missing sources are unknown, never invented."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Response

router = APIRouter(prefix="/api/public", tags=["public"])
_cache: dict[str, Any] = {"data": None, "ts": 0}
_CACHE_TTL = 60


async def _source(table: str, params: dict[str, str], *, count: bool = False) -> Any:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise ValueError("Telemetry storage is not configured")
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if count:
        headers["Prefer"] = "count=exact"
    async with httpx.AsyncClient(timeout=8.0) as client:
        result = await client.get(f"{url}/rest/v1/{table}", params=params, headers=headers)
    result.raise_for_status()
    if count:
        total = result.headers.get("content-range", "").rsplit("/", 1)[-1]
        if not total.isdigit():
            raise ValueError("Telemetry count unavailable")
        return int(total)
    rows = result.json()
    if not isinstance(rows, list):
        raise ValueError("Telemetry rows unavailable")
    return rows


@router.get("/stats")
async def get_public_stats(response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    now = time.time()
    if _cache["data"] is not None and now - _cache["ts"] < _CACHE_TTL:
        return {**_cache["data"], "cached": True}
    counts = {"select": "id", "limit": "0"}
    sources = await asyncio.gather(
        _source("agent_activity_logs", {"select": "agent_id,event_type,created_at", "order": "created_at.desc", "limit": "200"}),
        _source("workflow_runs", {**counts, "status": "eq.completed"}, count=True),
        _source("approval_queue", {**counts, "status": "eq.pending"}, count=True),
        _source("hermes_tasks", {**counts, "status": "in.(COMPLETED,FAILED,CANCELLED)"}, count=True),
        return_exceptions=True,
    )
    available = [not isinstance(item, BaseException) for item in sources]
    agent_events = sources[0]
    events = [] if isinstance(agent_events, BaseException) else agent_events
    latest_by_agent: dict[str, str] = {}
    for row in events:
        agent_id = row.get("agent_id")
        if agent_id and agent_id not in latest_by_agent:
            latest_by_agent[agent_id] = row.get("event_type", "")
    payload = {
        "contract": "public-stats-v1",
        "active_agents": sum(event == "started" for event in latest_by_agent.values()) if available[0] else None,
        "completed_workflows": sources[1] if available[1] else None,
        "queue_pending": sources[2] if available[2] else None,
        "total_tasks_processed": sources[3] if available[3] else None,
        "uptime_percent": None,
        "system_health": "unknown",
        "latest_events": events[:5],
        "telemetry_available": all(available),
        "source_status": dict(zip(("agent_activity", "completed_workflows", "approval_queue", "hermes_tasks"),
                                  ("available" if ok else "unavailable" for ok in available))),
        "active_agents_basis": "latest event per agent within 200 most recent events",
        "cached": False,
        "observed_at": now,
    }
    if all(available):
        _cache.update(data=payload, ts=now)
    return payload


@router.get("/health")
async def public_health() -> dict[str, str]:
    configured = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    return {"status": "ok", "service": "d3vonn-public-api",
            "supabase": "configured" if configured else "not_configured"}
