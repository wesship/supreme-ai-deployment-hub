"""Canonical D3VONN event envelope adapters.

This module does not create a second event store. It adapts existing governed
records (starting with PRIMETIME audit events) into a stable cross-runtime
contract that matches the TypeScript boundary under ``src/platform/d3vonn``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid5

from pydantic import BaseModel, Field

_EVENT_NAMESPACE = UUID("f46928b6-c51e-4cad-87ad-7eb2682f6244")


class DomainEventEnvelope(BaseModel):
    id: str
    workspaceId: str
    eventType: str
    aggregateType: str
    aggregateId: str
    eventVersion: int = Field(default=1, ge=1)
    occurredAt: str
    payload: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotencyKey: str | None = None


def _stable_event_id(audit_row: dict[str, Any]) -> str:
    existing = audit_row.get("id")
    if existing:
        return str(existing)

    seed = "|".join(
        [
            str(audit_row.get("workspace_id") or ""),
            str(audit_row.get("action") or ""),
            str(audit_row.get("entity_type") or ""),
            str(audit_row.get("entity_id") or ""),
            str(audit_row.get("created_at") or ""),
        ]
    )
    return str(uuid5(_EVENT_NAMESPACE, seed))


def audit_row_to_domain_event(audit_row: dict[str, Any]) -> DomainEventEnvelope:
    """Adapt one governed PRIMETIME audit row to the shared D3VONN envelope.

    The source audit row remains canonical persistence. This function is a read
    adapter only; it neither inserts nor mutates database records.
    """
    workspace_id = str(audit_row.get("workspace_id") or "")
    event_type = str(audit_row.get("action") or "")
    aggregate_type = str(audit_row.get("entity_type") or "")
    aggregate_id = str(audit_row.get("entity_id") or "")

    if not workspace_id:
        raise ValueError("audit row is missing workspace_id")
    if not event_type:
        raise ValueError("audit row is missing action")
    if not aggregate_type:
        raise ValueError("audit row is missing entity_type")

    occurred_at = audit_row.get("created_at") or audit_row.get("occurred_at")
    if not occurred_at:
        occurred_at = datetime.now(timezone.utc).isoformat()

    metadata = dict(audit_row.get("metadata") or {})
    actor_id = audit_row.get("actor_id")
    if actor_id:
        metadata.setdefault("actorId", str(actor_id))
    metadata.setdefault("source", "primetime.audit_events")

    event_id = _stable_event_id(audit_row)
    idempotency_key = f"primetime-audit:{event_id}"

    payload = {
        "auditEventId": str(audit_row.get("id") or event_id),
        "entityId": aggregate_id or None,
        "metadata": dict(audit_row.get("metadata") or {}),
    }

    return DomainEventEnvelope(
        id=event_id,
        workspaceId=workspace_id,
        eventType=event_type,
        aggregateType=aggregate_type,
        aggregateId=aggregate_id,
        eventVersion=1,
        occurredAt=str(occurred_at),
        payload=payload,
        metadata=metadata,
        idempotencyKey=idempotency_key,
    )
