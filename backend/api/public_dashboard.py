"""Public D3VONN dashboard telemetry aggregation.

This module is deliberately read-only. It aggregates existing OCC/ops sources
and never creates a second telemetry store.
"""
from __future__ import annotations

import asyncio
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import httpx
from fastapi import APIRouter, Header, HTTPException

from backend.api.v1.router import operations_health

router = APIRouter(prefix="/api/public", tags=["public-dashboard"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DASHBOARD_KEY = os.getenv("D3VONN_DASHBOARD_KEY", "")
ACTIVE_WINDOW_MINUTES = int(os.getenv("D3VONN_DASHBOARD_ACTIVE_WINDOW_MINUTES", "15"))
GRAPH_TABLES = tuple(
    name.strip()
    for name in os.getenv(
        "D3VONN_DASHBOARD_GRAPH_TABLES",
        "knowledge_nodes,agent_registry,tool_registry",
    ).split(",")
    if name.strip()
)

_TERMINAL_EVENTS = {"completed", "failed", "stopped", "cancelled", "canceled", "paused"}
_ACTIVE_EVENTS = {"started", "resumed", "running", "working"}
_SUCCESS_STATUSES = {"success", "completed", "ok"}
_FAILURE_STATUSES = {"error", "failed", "timeout"}


def _headers(*, count: bool = False) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if count:
        headers["Prefer"] = "count=exact"
    return headers


def _require_dashboard_key(value: str | None) -> None:
    if DASHBOARD_KEY and value != DASHBOARD_KEY:
        raise HTTPException(status_code=401, detail="dashboard authorization required")


async def _query(
    table: str,
    *,
    select: str = "*",
    order: str = "created_at.desc",
    limit: int = 1000,
    filters: dict[str, str] | None = None,
) -> list[dict[str, Any]] | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    params = {"select": select, "order": order, "limit": str(limit)}
    if filters:
        params.update(filters)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers=_headers(),
                params=params,
            )
        if response.status_code != 200:
            return None
        body = response.json()
        return body if isinstance(body, list) else None
    except (httpx.RequestError, ValueError):
        return None


async def _count_table(table: str) -> int | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers={**_headers(count=True), "Range": "0-0"},
                params={"select": "id"},
            )
        if response.status_code not in {200, 206}:
            return None
        content_range = response.headers.get("content-range", "")
        if "/" not in content_range:
            return None
        total = content_range.rsplit("/", 1)[1]
        return int(total) if total.isdigit() else None
    except (httpx.RequestError, ValueError):
        return None


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _latest_by(rows: Iterable[dict[str, Any]], key_name: str) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = row.get(key_name)
        if not key:
            continue
        current = latest.get(str(key))
        if current is None:
            latest[str(key)] = row
            continue
        row_time = _parse_time(row.get("created_at"))
        current_time = _parse_time(current.get("created_at"))
        if row_time and (current_time is None or row_time > current_time):
            latest[str(key)] = row
    return latest


def _activity_summary(rows: list[dict[str, Any]] | None) -> dict[str, Any]:
    if rows is None:
        return {
            "active_agents": None,
            "running_tasks": None,
            "success_rate": None,
            "top_agents": [],
            "activity_feed": [],
        }

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=ACTIVE_WINDOW_MINUTES)
    agent_latest = _latest_by(rows, "agent_id")
    session_latest = _latest_by((row for row in rows if row.get("session_id")), "session_id")

    active_agents = 0
    for row in agent_latest.values():
        created = _parse_time(row.get("created_at"))
        event = str(row.get("event_type") or "").lower()
        status = str(row.get("status") or "").lower()
        if created and created >= cutoff and event not in _TERMINAL_EVENTS and status not in _FAILURE_STATUSES:
            active_agents += 1

    running_tasks = sum(
        1
        for row in session_latest.values()
        if str(row.get("event_type") or "").lower() in _ACTIVE_EVENTS
        and str(row.get("status") or "").lower() not in _FAILURE_STATUSES
    )

    completed = 0
    succeeded = 0
    agent_counts: Counter[str] = Counter()
    for row in rows:
        status = str(row.get("status") or "").lower()
        event = str(row.get("event_type") or "").lower()
        if status in _SUCCESS_STATUSES | _FAILURE_STATUSES or event in {"completed", "failed"}:
            completed += 1
            if status in _SUCCESS_STATUSES or (event == "completed" and status not in _FAILURE_STATUSES):
                succeeded += 1
        label = row.get("agent_name") or row.get("agent_id")
        if label:
            agent_counts[str(label)] += 1

    success_rate = round((succeeded / completed) * 100, 1) if completed else None
    feed = [
        {
            "id": row.get("id"),
            "created_at": row.get("created_at"),
            "agent_id": row.get("agent_id"),
            "agent_name": row.get("agent_name"),
            "event_type": row.get("event_type"),
            "status": row.get("status"),
            "duration_ms": row.get("duration_ms"),
        }
        for row in rows[:20]
    ]
    top_agents = [
        {"agent": name, "events": count}
        for name, count in agent_counts.most_common(8)
    ]
    return {
        "active_agents": active_agents,
        "running_tasks": running_tasks,
        "success_rate": success_rate,
        "top_agents": top_agents,
        "activity_feed": feed,
    }


def _cost_buckets(
    rows: list[dict[str, Any]] | None,
    *,
    now: datetime,
) -> dict[str, Any]:
    if rows is None:
        return {"total_usd": None, "last_24h": [], "last_7d": [], "last_30d": []}

    hourly: defaultdict[str, float] = defaultdict(float)
    daily: defaultdict[str, float] = defaultdict(float)
    total = 0.0

    for row in rows:
        created = _parse_time(row.get("created_at"))
        if not created:
            continue
        try:
            cost = float(row.get("cost_usd") or 0)
        except (TypeError, ValueError):
            cost = 0.0
        total += cost
        if created >= now - timedelta(hours=24):
            hourly[created.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")] += cost
        if created >= now - timedelta(days=30):
            daily[created.astimezone(timezone.utc).strftime("%Y-%m-%d")] += cost

    def series(source: dict[str, float], cutoff: datetime) -> list[dict[str, Any]]:
        result = []
        for bucket, cost in sorted(source.items()):
            stamp = _parse_time(bucket) if "T" in bucket else datetime.fromisoformat(bucket).replace(tzinfo=timezone.utc)
            if stamp >= cutoff:
                result.append({"bucket": bucket, "cost_usd": round(cost, 6)})
        return result

    return {
        "total_usd": round(total, 6),
        "last_24h": series(hourly, now - timedelta(hours=24)),
        "last_7d": series(daily, now - timedelta(days=7)),
        "last_30d": series(daily, now - timedelta(days=30)),
    }


async def _health_summary() -> dict[str, Any]:
    try:
        health = await operations_health()
        if hasattr(health, "model_dump"):
            data = health.model_dump()
        elif isinstance(health, dict):
            data = health
        else:
            data = {}
        components = data.get("components") or []
        healthy = [item for item in components if item.get("status") == "healthy"]
        uptime = round((len(healthy) / len(components)) * 100, 1) if components else None
        return {
            "overall": data.get("overall"),
            "uptime_percent": uptime,
            "checked_at": data.get("checked_at"),
            "components": components,
        }
    except Exception:
        return {"overall": None, "uptime_percent": None, "checked_at": None, "components": []}


@router.get("/dashboard")
async def public_dashboard(
    x_d3vonn_dashboard_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Aggregate existing production telemetry for the public dashboard."""
    _require_dashboard_key(x_d3vonn_dashboard_key)
    now = datetime.now(timezone.utc)

    activity_task = _query(
        "agent_activity_logs",
        select="id,created_at,agent_id,agent_name,event_type,session_id,duration_ms,status",
        limit=2000,
    )
    cost_task = _query(
        "ai_request_logs",
        select="id,created_at,cost_usd,status,model,provider",
        limit=5000,
        filters={"created_at": f"gte.{(now - timedelta(days=30)).isoformat()}"},
    )
    health_task = _health_summary()
    graph_tasks = [_count_table(table) for table in GRAPH_TABLES]

    activity_rows, cost_rows, health, graph_counts = await asyncio.gather(
        activity_task,
        cost_task,
        health_task,
        asyncio.gather(*graph_tasks),
    )

    activity = _activity_summary(activity_rows)
    graph = {
        table: count
        for table, count in zip(GRAPH_TABLES, graph_counts)
    }

    return {
        "status": "live",
        "generated_at": now.isoformat(),
        "metrics": {
            "active_agents": activity["active_agents"],
            "running_tasks": activity["running_tasks"],
            "success_rate_percent": activity["success_rate"],
            "uptime_percent": health["uptime_percent"],
        },
        "infrastructure": health,
        "activity_feed": activity["activity_feed"],
        "top_agents": activity["top_agents"],
        "cost_usage": _cost_buckets(cost_rows, now=now),
        "graph_nodes": graph,
        "bridges": None,
        "execution_flow": None,
        "methodology": {
            "active_window_minutes": ACTIVE_WINDOW_MINUTES,
            "active_agents": "latest agent activity inside active window, excluding terminal/failed states",
            "running_tasks": "latest session event is started/resumed/running/working",
            "success_rate": "successful terminal activity divided by all terminal activity in the retrieved window",
            "uptime_percent": "healthy components divided by components returned by /api/v1/ops/health at request time",
            "bridges": "not reported until a production source is configured",
            "execution_flow": "not reported until a production source is configured",
        },
    }
