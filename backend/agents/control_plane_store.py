"""Backend-only Agent OS atomic control-plane persistence.

All mutations go through PostgreSQL RPC functions that update governance state and
write PRIMETIME audit evidence inside the same transaction. Browser callers never
receive service-role credentials or direct table mutation access.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from backend.app.routers.primetime_release1 import _get_supabase_base, _headers


async def _rpc(function_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{base}/rest/v1/rpc/{function_name}",
            headers=_headers(),
            json=payload,
        )
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError(f"Unexpected RPC response for {function_name}")
    return body


async def set_workspace_policy(
    *,
    workspace_id: str,
    kill_switch_enabled: bool,
    disabled_agents: set[str],
    actor_user_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    return await _rpc(
        "agent_os_set_workspace_policy",
        {
            "p_workspace_id": workspace_id,
            "p_kill_switch_enabled": kill_switch_enabled,
            "p_disabled_agents": sorted(disabled_agents),
            "p_actor_user_id": actor_user_id,
            "p_reason": reason,
        },
    )


async def grant_approval(
    *,
    workspace_id: str,
    action: str,
    agent_name: str | None,
    actor_user_id: str,
    expires_at: datetime,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return await _rpc(
        "agent_os_grant_approval",
        {
            "p_workspace_id": workspace_id,
            "p_action": action,
            "p_agent_name": agent_name,
            "p_actor_user_id": actor_user_id,
            "p_expires_at": expires_at.isoformat(),
            "p_reason": reason,
            "p_metadata": metadata or {},
        },
    )


async def revoke_approval(
    *,
    workspace_id: str,
    approval_id: str,
    actor_user_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    return await _rpc(
        "agent_os_revoke_approval",
        {
            "p_workspace_id": workspace_id,
            "p_approval_id": approval_id,
            "p_actor_user_id": actor_user_id,
            "p_reason": reason,
        },
    )
