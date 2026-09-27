"""Authenticated SSE stream for user-bound Hermes lifecycle events."""
from __future__ import annotations

import asyncio
import json
from collections import deque
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse

from backend.app.middleware.auth import get_current_user_id
from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import get_task_by_correlation_id

router = APIRouter(prefix="/hermes", tags=["hermes-events"])

_POLL_SECONDS = 1.0
_HEARTBEAT_SECONDS = 15
_MAX_BATCH = 100


def _public_event(row: dict[str, Any]) -> dict[str, Any]:
    data = row.get("data")
    if not isinstance(data, dict):
        data = {}
    return {
        "id": str(row.get("id") or ""),
        "type": str(row.get("event") or "hermes.event"),
        "message": str(row.get("message") or ""),
        "level": str(row.get("level") or "info"),
        "taskId": row.get("task_id"),
        "runId": row.get("run_id"),
        "agentName": row.get("agent_name"),
        "correlationId": row.get("correlation_id"),
        "timestamp": row.get("created_at"),
        "data": data,
    }


async def _authorized_correlation(correlation_id: str, user_id: str) -> dict[str, Any]:
    task = await get_task_by_correlation_id(correlation_id)
    if not task:
        raise HTTPException(status_code=404, detail="Hermes execution not found")

    input_data = task.get("input_data")
    owner = input_data.get("authenticated_user_id") if isinstance(input_data, dict) else None
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Hermes execution access denied")
    return task


@router.get("/events/stream")
async def stream_hermes_events(
    request: Request,
    correlation_id: str = Query(..., min_length=8, max_length=120),
    once: bool = Query(False, description="Emit the currently available batch then close. Intended for diagnostics/certification."),
    user_id: str = Depends(get_current_user_id),
) -> EventSourceResponse:
    """Stream lifecycle events for exactly one authenticated Hermes execution."""
    await _authorized_correlation(correlation_id, user_id)
    repository = get_dependencies().repository
    if not repository.configured:
        raise HTTPException(status_code=503, detail="Hermes event persistence is unavailable")

    async def events():
        last_created_at: str | None = None
        sent_ids: set[str] = set()
        sent_order: deque[str] = deque()

        while True:
            if await request.is_disconnected():
                break

            params: dict[str, Any] = {
                "correlation_id": f"eq.{correlation_id}",
                "order": "created_at.asc,id.asc",
                "limit": str(_MAX_BATCH),
            }
            if last_created_at:
                params["created_at"] = f"gte.{last_created_at}"

            rows = await repository.list_rows("hermes_logs", params)
            emitted = False
            for row in rows:
                event_id = str(row.get("id") or "")
                if not event_id or event_id in sent_ids:
                    continue
                sent_ids.add(event_id)
                sent_order.append(event_id)
                if len(sent_order) > 500:
                    oldest = sent_order.popleft()
                    sent_ids.discard(oldest)
                timestamp = row.get("created_at")
                if isinstance(timestamp, str):
                    last_created_at = timestamp

                payload = _public_event(row)
                emitted = True
                yield {
                    "id": event_id,
                    "event": payload["type"],
                    "data": json.dumps(payload, separators=(",", ":")),
                }

            if once:
                break

            if not emitted:
                await asyncio.sleep(_POLL_SECONDS)

    return EventSourceResponse(
        events(),
        ping=_HEARTBEAT_SECONDS,
        headers={
            "Cache-Control": "no-store, no-cache",
            "X-Accel-Buffering": "no",
        },
    )
