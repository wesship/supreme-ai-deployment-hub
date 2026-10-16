"""Gate 12 private stem API contract. Read-only, fail-closed and not mounted.

The caller identity is obtained from the Supabase Auth user endpoint. No client
owner IDs, production uploads, queue writes, signed URLs or model execution.
"""
from __future__ import annotations

import os
import re
import uuid

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

router = APIRouter(prefix="/music/stems", tags=["music-stems"])
UUID_PATTERN = re.compile(r"^[a-fA-F0-9-]{36}$")


class StemGateStatus(BaseModel):
    separation_enabled: bool = False
    upload_enabled: bool = False
    queue_enabled: bool = False
    model_qualified: bool = False
    message: str = "Stem separation requires operator qualification and staging verification."


def bearer_token(value: str | None) -> str:
    if not value or not value.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = value.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return token


async def verified_owner(authorization: str | None) -> str:
    try:
        user = await SupabaseRLSClient(bearer_token(authorization)).current_user()
        return str(uuid.UUID(user.id))
    except HTTPException:
        raise
    except (OrchestrationError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Authenticated user could not be verified") from exc


@router.get("/capabilities", response_model=StemGateStatus)
async def get_capabilities(authorization: str | None = Header(default=None)) -> StemGateStatus:
    await verified_owner(authorization)
    return StemGateStatus()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, authorization: str | None = Header(default=None)) -> dict[str, str]:
    await verified_owner(authorization)
    try:
        uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid job identifier") from exc
    # Deliberately do not return stub statuses that could imply real jobs exist.
    raise HTTPException(status_code=503, detail="Private stem job store not connected")


@router.post("/uploads")
async def upload_not_ready(authorization: str | None = Header(default=None)) -> None:
    await verified_owner(authorization)
    raise HTTPException(status_code=503, detail="Private upload service not qualified")


@router.post("/jobs")
async def submit_not_ready(authorization: str | None = Header(default=None)) -> None:
    await verified_owner(authorization)
    raise HTTPException(status_code=503, detail="Hermes separation queue not qualified")
