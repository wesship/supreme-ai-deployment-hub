from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.middleware.auth import get_current_user_id

router = APIRouter(tags=["wearables"])


class WearableSource(BaseModel):
    adapter: str = Field(min_length=1, max_length=100)
    device_id: str = Field(min_length=1, max_length=200)
    session_id: str = Field(min_length=1, max_length=200)


class WearablePrivacy(BaseModel):
    classification: str = Field(pattern=r"^(user_private|sensitive|restricted)$")
    consent: bool


class WearableAudit(BaseModel):
    policy_version: str = Field(min_length=1, max_length=100)
    trace_id: str = Field(min_length=1, max_length=200)


class WearableEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=200)
    event_type: str = Field(min_length=1, max_length=100)
    occurred_at: datetime
    source: WearableSource
    correlation_id: str = Field(min_length=1, max_length=200)
    privacy: WearablePrivacy
    payload: Dict[str, Any] = Field(default_factory=dict)
    capabilities: List[str] = Field(default_factory=list, max_length=20)
    audit: WearableAudit


ALLOWED_EVENT_PREFIXES = ("wearable.", "vision.", "audio.", "approval.")


def _validate_event(event: WearableEvent) -> None:
    if not event.event_type.startswith(ALLOWED_EVENT_PREFIXES):
        raise HTTPException(status_code=422, detail="unsupported wearable event type")
    if not event.privacy.consent:
        raise HTTPException(status_code=403, detail="wearable capture consent is required")
    if event.event_type.startswith("vision.") and "camera" not in event.capabilities:
        raise HTTPException(status_code=422, detail="vision events require camera capability")
    if event.event_type.startswith("audio.") and not ({"microphone", "speaker"} & set(event.capabilities)):
        raise HTTPException(status_code=422, detail="audio events require microphone or speaker capability")


async def _persist_event(event: WearableEvent, user_id: str) -> bool:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="wearable event persistence is not configured")
    body = event.model_dump(mode="json")
    payload_hash = hashlib.sha256(json.dumps(body["payload"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    row = {"event_id": event.event_id, "event_type": event.event_type, "occurred_at": event.occurred_at.isoformat(), "user_id": user_id, "device_id": event.source.device_id, "adapter": event.source.adapter, "session_id": event.source.session_id, "correlation_id": event.correlation_id, "privacy_classification": event.privacy.classification, "consent": event.privacy.consent, "payload": body["payload"], "capabilities": event.capabilities, "policy_version": event.audit.policy_version, "trace_id": event.audit.trace_id, "payload_hash": payload_hash}
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation,resolution=ignore-duplicates"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{base}/rest/v1/wearable_events", headers=headers, json=row)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="wearable event store unavailable")
    return bool(response.json())


@router.post("/vision/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_wearable_event(event: WearableEvent, user_id: str = Depends(get_current_user_id)):
    _validate_event(event)
    inserted = await _persist_event(event, user_id)
    return {"accepted": True, "duplicate": not inserted, "event_id": event.event_id, "correlation_id": event.correlation_id, "next": "queued" if inserted else "already_processed"}
