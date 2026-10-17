"""Fail-closed voice action boundary for Hermes.

This module is deliberately not wired to a route until trusted identity and
persistent session lookup are configured. It never invokes Hermes itself.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable, Mapping, Any
from uuid import UUID

SessionLoader = Callable[[UUID], Awaitable[Mapping[str, Any] | None]]
MAX_SESSION_SECONDS = 300


def _utc_datetime(value: Any) -> datetime | None:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime) or value.tzinfo is None:
        return None
    return value.astimezone(timezone.utc)


async def authorize_hermes_voice_action(
    session_id: str,
    authenticated_user_id: str,
    load_session: SessionLoader,
    *,
    now: datetime | None = None,
) -> bool:
    """Authorize only an active, owner-bound, unrevoked database session."""
    try:
        sid = UUID(session_id)
        uid = UUID(authenticated_user_id)
        current = _utc_datetime(now or datetime.now(timezone.utc))
        if current is None:
            return False
        record = await load_session(sid)
        if not record or UUID(str(record.get("id"))) != sid:
            return False
        if UUID(str(record.get("user_id"))) != uid:
            return False
        created = _utc_datetime(record.get("created_at"))
        expires = _utc_datetime(record.get("expires_at"))
        if not created or not expires or record.get("revoked_at") is not None:
            return False
        ttl = (expires - created).total_seconds()
        return 0 < ttl <= MAX_SESSION_SECONDS and created <= current < expires
    except (Exception):
        return False
