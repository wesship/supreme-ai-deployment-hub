"""Scoped Sibyl ingress. Persists drafts only; never writes the execution queue."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from backend.hermes.infrastructure import SupabaseRestClient

_store = SupabaseRestClient()
TABLE = "hermes_sibyl_planning_drafts"
CONTRACT = "sibyl-planning-v1"


class PlanningMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    source: Literal["astral-sibyl-echo"]
    intent: Literal["planning_only"]
    execution_allowed: StrictBool
    synthetic: StrictBool = False
    actor_ref: str = Field(pattern=r"^[0-9a-f]{24}$")
    idempotency_key: str

    @field_validator("execution_allowed")
    @classmethod
    def no_execution(cls, value: bool) -> bool:
        if value:
            raise ValueError("execution is not allowed")
        return value

    @field_validator("idempotency_key")
    @classmethod
    def uuid_key(cls, value: str) -> str:
        return str(UUID(value))


class PlanningRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=4000)
    metadata: PlanningMetadata

    @field_validator("title", "description")
    @classmethod
    def plain_text(cls, value: str) -> str:
        if not value.strip() or any(ord(c) < 32 and c not in "\n\r\t" or ord(c) == 127 for c in value):
            raise ValueError("nonempty plain text required")
        return value


def require_service(authorization: str = Header(default="", alias="Authorization")) -> str:
    """A dedicated token is scoped to this router and a single pseudonymous actor."""
    token = os.getenv("HERMES_SIBYL_SERVICE_TOKEN", "").strip()
    actor = os.getenv("HERMES_SIBYL_ACTOR_REF", "").strip()
    if len(token) < 32 or len(actor) != 24 or any(c not in "0123456789abcdef" for c in actor):
        raise HTTPException(503, "Sibyl planning ingress is not configured")
    if not authorization.startswith("Bearer ") or not hmac.compare_digest(authorization[7:].encode(), token.encode()):
        raise HTTPException(401, "Invalid Sibyl service credential")
    return actor


class BoundedPlanningRoute(APIRoute):
    """Authenticate before JSON parsing and bound streamed bodies without trusting length."""
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request: Request):
            require_service(request.headers.get("authorization", ""))
            if request.method == "POST":
                chunks = []
                length = 0
                async for chunk in request.stream():
                    length += len(chunk)
                    if length > 16_384:
                        raise HTTPException(413, "Planning request too large")
                    chunks.append(chunk)
                # Cache the bounded stream for FastAPI's standard model validation.
                request._body = b"".join(chunks)
            return await handler(request)

        return bounded


router = APIRouter(prefix="/api/hermes/sibyl/v1", tags=["sibyl-planning"], route_class=BoundedPlanningRoute)


@router.get("/capabilities")
async def capabilities(_: str = Depends(require_service)) -> dict:
    return {"contract": CONTRACT, "planning_only": True, "execution_allowed": False,
            "idempotency": "actor_and_key_unique", "receipt_format": "object.id"}


@router.post("/drafts", status_code=201)
async def create_draft(
    body: PlanningRequest,
    actor: str = Depends(require_service),
    idempotency_key: str = Header(default="", alias="Idempotency-Key"),
) -> dict:
    if not hmac.compare_digest(actor, body.metadata.actor_ref):
        raise HTTPException(403, "Actor is not linked to this credential")
    try:
        header_key = str(UUID(idempotency_key))
    except ValueError:
        raise HTTPException(422, "Idempotency-Key UUID required") from None
    if header_key != body.metadata.idempotency_key:
        raise HTTPException(422, "Idempotency keys must match")
    if not _store.configured:
        raise HTTPException(503, "Planning storage is not configured")
    # Source, intent, actor and execution policy are set by the receiver, not copied
    # into any task payload. The unique constraint serializes concurrent retries.
    digest = hashlib.sha256(json.dumps(body.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    payload = {"actor_ref": actor, "idempotency_key": header_key, "payload_sha256": digest,
               "title": body.title, "summary": body.description, "synthetic": body.metadata.synthetic}
    duplicate = False
    try:
        row = await _store.post(TABLE, payload)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 409:
            raise HTTPException(503, "Planning storage unavailable") from None
        try:
            rows = await _store.get(TABLE, {"actor_ref": f"eq.{actor}", "idempotency_key": f"eq.{header_key}", "limit": 1})
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "Planning storage unavailable") from None
        if not rows:
            raise HTTPException(503, "Planning receipt unavailable")
        row = rows[0]
        if row.get("payload_sha256") != digest:
            raise HTTPException(409, "Idempotency key was used for different content")
        duplicate = True
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Planning storage unavailable") from None
    if not row or not row.get("id"):
        raise HTTPException(503, "Planning receipt unavailable")
    return {"id": str(row["id"]), "contract": CONTRACT, "duplicate": duplicate,
            "status": "draft", "planning_only": True, "execution_allowed": False}
