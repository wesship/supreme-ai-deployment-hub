"""Append-only PRIMETIME event ledger helpers.

The ledger is the forensic timeline for governed ingestion and downstream
agent execution. Writes are intentionally small and workspace-scoped; callers
must already have authenticated and resolved membership.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx


def _supabase_config() -> tuple[str, str]:
    import os
    return os.getenv("SUPABASE_URL", "").rstrip("/"), os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


async def append_event(
    *,
    workspace_id: str,
    event_type: str,
    actor_type: str,
    actor_id: str | None = None,
    lead_id: str | None = None,
    interaction_id: str | None = None,
    correlation_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Append one event; never update or delete an existing event."""
    base, key = _supabase_config()
    if not base or not key:
        raise RuntimeError("Supabase configuration required for PRIMETIME event ledger")
    row = {
        "workspace_id": workspace_id,
        "event_type": event_type,
        "actor_type": actor_type,
        "actor_id": actor_id,
        "lead_id": lead_id,
        "interaction_id": interaction_id,
        "correlation_id": correlation_id,
        "payload": payload or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(f"{base}/rest/v1/primetime_event_ledger", headers=headers, json=row)
    if response.status_code >= 300:
        raise RuntimeError(f"PRIMETIME ledger write failed: HTTP {response.status_code}")
