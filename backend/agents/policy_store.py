"""Backend-only Agent OS policy persistence adapter.

Reads and writes workspace kill switches, disabled-agent overrides, and active
approvals through the existing governed Supabase REST boundary. Browser clients
never receive service-role credentials or direct table access.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from backend.app.routers.primetime_release1 import _get_supabase_base, _headers


async def _rest_get(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{base}/rest/v1/{path}", headers=_headers(), params=params)
    response.raise_for_status()
    return response.json()


async def _rest_post(path: str, payload: dict[str, Any], *, prefer: str = "return=representation") -> list[dict[str, Any]]:
    base = _get_supabase_base()
    headers = _headers(prefer)
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{base}/rest/v1/{path}", headers=headers, json=payload)
    response.raise_for_status()
    return response.json() if response.content else []


async def _rest_patch(path: str, params: dict[str, str], payload: dict[str, Any]) -> list[dict[str, Any]]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(
            f"{base}/rest/v1/{path}", headers=_headers(), params=params, json=payload
        )
    response.raise_for_status()
    return response.json() if response.content else []


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


async def upsert_workspace_policy(
    *,
    workspace_id: str,
    kill_switch_enabled: bool,
    disabled_agents: set[str],
    updated_by: str,
) -> dict[str, Any]:
    payload = {
        "workspace_id": workspace_id,
        "kill_switch_enabled": kill_switch_enabled,
        "disabled_agents": sorted(disabled_agents),
        "updated_by": updated_by,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    base = _get_supabase_base()
    headers = _headers("resolution=merge-duplicates,return=representation")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{base}/rest/v1/agent_os_workspace_policies",
            headers=headers,
            params={"on_conflict": "workspace_id"},
            json=payload,
        )
    response.raise_for_status()
    rows = response.json() if response.content else []
    return rows[0] if rows else payload


async def create_approval(
    *,
    workspace_id: str,
    action: str,
    agent_name: str | None,
    approved_by: str,
    expires_at: str,
    reason: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    rows = await _rest_post(
        "agent_os_approvals",
        {
            "workspace_id": workspace_id,
            "action": action,
            "agent_name": agent_name,
            "approved_by": approved_by,
            "expires_at": expires_at,
            "reason": reason,
            "metadata": metadata or {},
        },
    )
    if not rows:
        raise RuntimeError("approval insert returned no row")
    return rows[0]


async def revoke_approval(*, workspace_id: str, approval_id: str, revoked_by: str) -> dict[str, Any] | None:
    rows = await _rest_patch(
        "agent_os_approvals",
        {
            "id": f"eq.{approval_id}",
            "workspace_id": f"eq.{workspace_id}",
            "revoked_at": "is.null",
        },
        {
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "revoked_by": revoked_by,
        },
    )
    return rows[0] if rows else None
