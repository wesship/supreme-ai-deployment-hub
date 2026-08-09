"""Pre/post dispatch audit evidence for Agent OS enforcement."""
from __future__ import annotations

from typing import Any

import httpx

from backend.app.routers.primetime_release1 import _get_supabase_base, _headers


async def write_dispatch_audit(
    *,
    workspace_id: str,
    actor_user_id: str,
    event_type: str,
    agent_name: str,
    action: str,
    task_id: str,
    event_data: dict[str, Any],
) -> None:
    """Write one PRIMETIME audit event. Raises on failure so callers can fail closed."""
    base = _get_supabase_base()
    payload = {
        "workspace_id": workspace_id,
        "actor_id": actor_user_id,
        "action": event_type,
        "entity_type": "agent_task",
        "entity_id": None,
        "metadata": {
            "agent_name": agent_name,
            "action": action,
            "task_id": task_id,
            **event_data,
        },
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{base}/rest/v1/primetime_audit_events",
            headers={**_headers(), "Prefer": "return=minimal"},
            json=payload,
        )
    response.raise_for_status()
