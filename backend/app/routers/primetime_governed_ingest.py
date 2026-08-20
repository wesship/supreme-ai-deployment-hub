"""PRIMETIME governed intelligence ingestion boundary.

Authentication and workspace membership are resolved from the authenticated
principal. The submitted organization value is metadata only. This router is
intentionally contract-first: durable persistence/queue execution is wired in
later increments after the foundation migration is validated in staging.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field

from ..middleware.auth import get_current_user_id
from .primetime_release1 import _membership_required

router = APIRouter(prefix="/api/v1/primetime", tags=["primetime-governed"])

MAX_BODY_BYTES = int(os.getenv("PRIMETIME_INGEST_MAX_BODY_BYTES", "262144"))
REPLAY_WINDOW_SECONDS = int(os.getenv("PRIMETIME_INGEST_REPLAY_WINDOW_SECONDS", "300"))
INGEST_SIGNING_SECRET = os.getenv("PRIMETIME_INGEST_SIGNING_SECRET", "")


class InteractionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str = Field(min_length=1, max_length=80)
    channel: str | None = Field(default=None, max_length=40)
    content: str | None = Field(default=None, max_length=100000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class LeadPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    external_id: str | None = Field(default=None, max_length=240)
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)


class GovernedIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = Field(min_length=8, max_length=200)
    event_type: Literal["interaction.received"]
    occurred_at: datetime
    organization: str | None = Field(default=None, max_length=200)
    lead: LeadPayload
    interaction: InteractionPayload


class GovernedIngestResponse(BaseModel):
    accepted: bool
    status: Literal["accepted"]
    request_id: str
    workspace_id: str
    idempotency_key: str


def _canonical_signature(timestamp: str, body: bytes) -> str:
    return hmac.new(
        INGEST_SIGNING_SECRET.encode("utf-8"),
        timestamp.encode("utf-8") + b"." + body,
        hashlib.sha256,
    ).hexdigest()


def _validate_signature(timestamp: str | None, signature: str | None, body: bytes) -> None:
    if not INGEST_SIGNING_SECRET:
        raise HTTPException(status_code=503, detail="Ingest signing secret is not configured")
    if not timestamp or not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ingest signature required")
    try:
        timestamp_seconds = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest timestamp") from exc
    if abs(time.time() - timestamp_seconds) > REPLAY_WINDOW_SECONDS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ingest signature outside replay window")
    expected = _canonical_signature(timestamp, body)
    supplied = signature.removeprefix("sha256=")
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest signature")


@router.post("/ingest", response_model=GovernedIngestResponse, status_code=202)
async def governed_ingest(
    request: Request,
    payload: GovernedIngestRequest,
    user_id: str = Depends(get_current_user_id),
    x_primetime_timestamp: str | None = Header(default=None),
    x_primetime_signature: str | None = Header(default=None),
) -> GovernedIngestResponse:
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="PRIMETIME ingest request too large")

    _validate_signature(x_primetime_timestamp, x_primetime_signature, body)

    workspace_id = request.headers.get("x-primetime-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=403, detail="Authenticated PRIMETIME workspace context required")
    context = await _membership_required(workspace_id, user_id)

    request_id = request.headers.get("x-request-id") or hashlib.sha256(body).hexdigest()[:32]

    # Persistence and queue dispatch intentionally follow the foundation PR.
    # Returning 202 here would be unsafe if we implied durable acceptance, so
    # this contract-first implementation reports that the authenticated request
    # boundary is valid while downstream persistence is still feature-gated.
    if os.getenv("PRIMETIME_INGEST_ENABLE_RUNTIME", "false").lower() != "true":
        raise HTTPException(status_code=503, detail="PRIMETIME governed ingest runtime is not enabled")

    return GovernedIngestResponse(
        accepted=True,
        status="accepted",
        request_id=request_id,
        workspace_id=context["workspace_id"],
        idempotency_key=payload.idempotency_key,
    )
