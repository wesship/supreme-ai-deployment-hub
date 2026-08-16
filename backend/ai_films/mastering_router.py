"""Authenticated queue API for AI FILMS ACEScg/OpenEXR mastering."""
from __future__ import annotations

import re

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

router = APIRouter(prefix="/ai-films/mastering", tags=["ai-films", "mastering"])
_TIMECODE = re.compile(r"^\d{2}:\d{2}:\d{2}[:;]\d{2}$")


class MasteringQueueRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    source_asset_id: str = Field(..., min_length=1, max_length=100)
    shot_id: str = Field(..., min_length=1, max_length=160)
    start_timecode: str | None = Field(default=None, max_length=11)
    priority: int = Field(default=95, ge=1, le=100)

    @field_validator("start_timecode")
    @classmethod
    def validate_timecode(cls, value: str | None) -> str | None:
        if value is not None and not _TIMECODE.fullmatch(value):
            raise ValueError("start_timecode must use HH:MM:SS:FF or HH:MM:SS;FF")
        return value


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is empty")
    return token


@router.post("/queue", status_code=status.HTTP_201_CREATED)
async def queue_mastering(
    request: MasteringQueueRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Queue deterministic ACEScg/OpenEXR mastering without processing inline."""
    db = SupabaseRLSClient(_token(authorization))
    try:
        user = await db.current_user()
        job = await db.insert(
            "ai_film_render_jobs",
            {
                "project_id": request.project_id,
                "owner_id": user.id,
                "job_type": "mastering",
                "provider": "ffmpeg",
                "status": "queued",
                "priority": request.priority,
                "progress": 0,
                "input": {
                    "source_asset_id": request.source_asset_id,
                    "shot_id": request.shot_id,
                    "start_timecode": request.start_timecode,
                    "pipeline": "ffprobe->camera-color->acescg->openexr->otio->durable-storage",
                },
                "output": {},
            },
        )
        event = await db.insert(
            "ai_film_activity_events",
            {
                "project_id": request.project_id,
                "owner_id": user.id,
                "actor_id": user.id,
                "event_type": "mastering.queued",
                "target_type": "render_job",
                "target_id": job["id"],
                "summary": "AI FILMS queued ACEScg/OpenEXR mastering",
                "metadata": {
                    "source_asset_id": request.source_asset_id,
                    "shot_id": request.shot_id,
                    "priority": request.priority,
                },
            },
        )
    except OrchestrationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "status": "queued",
        "project_id": request.project_id,
        "source_asset_id": request.source_asset_id,
        "shot_id": request.shot_id,
        "render_job": job,
        "activity_event": event,
    }
