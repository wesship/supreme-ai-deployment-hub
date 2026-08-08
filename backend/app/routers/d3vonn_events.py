"""Governed read API for canonical D3VONN domain-event envelopes.

The endpoint reads the existing PRIMETIME audit trail, verifies workspace
membership with the Release 1 authorization boundary, and adapts rows into the
shared D3VONN event contract. It does not create or mutate event persistence.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..middleware.auth import get_current_user_id
from ..platform.d3vonn_events import DomainEventEnvelope, audit_row_to_domain_event
from .primetime_release1 import _membership_required, _query, _validate_uuid

router = APIRouter()


class DomainEventPage(BaseModel):
    items: list[DomainEventEnvelope]
    limit: int
    offset: int
    nextOffset: int | None = None


@router.get("/events", response_model=DomainEventPage, tags=["platform-events"])
async def list_domain_events(
    workspace_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0, le=10000),
    event_type: str | None = Query(default=None, min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.:-]+$"),
    aggregate_type: str | None = Query(default=None, min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.:-]+$"),
    user_id: str = Depends(get_current_user_id),
) -> DomainEventPage:
    """Return a workspace-scoped, paginated view of governed audit events."""
    safe_workspace = _validate_uuid(workspace_id, "workspace_id")
    await _membership_required(safe_workspace, user_id)

    params = {
        "select": "id,workspace_id,actor_id,action,entity_type,entity_id,metadata,created_at",
        "workspace_id": f"eq.{safe_workspace}",
        "order": "created_at.desc,id.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    if event_type:
        params["action"] = f"eq.{event_type}"
    if aggregate_type:
        params["entity_type"] = f"eq.{aggregate_type}"

    rows = await _query("audit_events", params)
    items = [audit_row_to_domain_event(row) for row in rows]
    next_offset = offset + len(items) if len(items) == limit else None

    return DomainEventPage(
        items=items,
        limit=limit,
        offset=offset,
        nextOffset=next_offset,
    )
