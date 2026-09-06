"""Backend-only Agent OS policy persistence adapter.

Reads workspace kill switches, disabled-agent overrides, and active approvals
through the existing governed Supabase REST helper. No browser credential or
direct table access is introduced.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from backend.app.routers.primetime_release1 import _get_supabase_base, _headers

_PAGE_SIZE = 200


async def _rest_get(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{base}/rest/v1/{path}",
            headers=_headers(),
            params=params,
        )
    response.raise_for_status()
    return response.json()


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


async def resolve_workspace_policy(workspace_id: str) -> tuple[bool, set[str]]:
    rows = await _rest_get(
        "agent_os_workspace_policies",
        {
            "select": "kill_switch_enabled,disabled_agents,canary_unlock_expires_at",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    if not rows:
        return False, set()
    row = rows[0]
    stored_kill_switch = bool(row.get("kill_switch_enabled"))
    lease_expires_at = _parse_timestamp(row.get("canary_unlock_expires_at"))
    lease_expired = lease_expires_at is not None and lease_expires_at <= datetime.now(timezone.utc)
    effective_kill_switch = stored_kill_switch or lease_expired
    return effective_kill_switch, set(row.get("disabled_agents") or [])


async def _active_approval_actions_for_scope(
    workspace_id: str,
    *,
    agent_filter: str,
) -> set[str]:
    """Return every active action for one already-filtered approval scope."""
    now = datetime.now(timezone.utc).isoformat()
    approved: set[str] = set()
    offset = 0

    while True:
        rows = await _rest_get(
            "agent_os_approvals",
            {
                "select": "action",
                "workspace_id": f"eq.{workspace_id}",
                "agent_name": agent_filter,
                "revoked_at": "is.null",
                "expires_at": f"gt.{now}",
                "order": "expires_at.desc,id.asc",
                "limit": str(_PAGE_SIZE),
                "offset": str(offset),
            },
        )
        for row in rows:
            action = row.get("action")
            if action:
                approved.add(str(action))

        if len(rows) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE

    return approved


async def resolve_active_approvals(workspace_id: str, agent_name: str) -> set[str]:
    """Resolve global + matching-agent approvals before any result limit is applied."""
    global_actions = await _active_approval_actions_for_scope(
        workspace_id,
        agent_filter="is.null",
    )
    scoped_actions = await _active_approval_actions_for_scope(
        workspace_id,
        agent_filter=f"eq.{agent_name}",
    )
    return global_actions | scoped_actions
