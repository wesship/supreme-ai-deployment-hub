"""Backend-only Agent OS policy persistence adapter.

Reads workspace kill switches, disabled-agent overrides, and active approvals
through the existing governed Supabase REST helper. No browser credential or
direct table access is introduced.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.app.routers.primetime_release1 import _get_supabase_base, _headers
import httpx


async def _rest_get(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{base}/rest/v1/{path}", headers=_headers(), params=params)
    response.raise_for_status()
    return response.json()


async def resolve_workspace_policy(workspace_id: str) -> tuple[bool, set[str]]:
    rows = await _rest_get(
        "agent_os_workspace_policies",
        {
            "select": "kill_switch_enabled,disabled_agents",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    if not rows:
        return False, set()
    row = rows[0]
    return bool(row.get("kill_switch_enabled")), set(row.get("disabled_agents") or [])


async def resolve_active_approvals(workspace_id: str, agent_name: str | None = None) -> set[str]:
    now = datetime.now(timezone.utc).isoformat()
    params = {
        "select": "action,agent_name,expires_at,revoked_at",
        "workspace_id": f"eq.{workspace_id}",
        "revoked_at": "is.null",
        "expires_at": f"gt.{now}",
        "order": "expires_at.desc",
        "limit": "200",
    }
    rows = await _rest_get("agent_os_approvals", params)
    approved: set[str] = set()
    for row in rows:
        scoped_agent = row.get("agent_name")
        if scoped_agent and scoped_agent != agent_name:
            continue
        action = row.get("action")
        if action:
            approved.add(str(action))
    return approved
