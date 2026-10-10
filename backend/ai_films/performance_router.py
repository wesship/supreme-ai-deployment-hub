"""Authenticated character performance endpoints for AI Films."""
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.character_performance import queue_character_performance_job
from backend.ai_films.orchestration import OrchestrationError
from backend.ai_films.router import _bearer_token

router = APIRouter(
    prefix="/ai-films/character-performance",
    tags=["ai-films", "character-performance"],
)


class CharacterPerformanceRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    capability: Literal[
        "avatar",
        "character_replacement",
        "lip_sync",
        "performance_transfer",
        "voice",
    ]
    provider: str = Field(default="replicate", min_length=1, max_length=50)
    source_asset_id: str | None = Field(default=None, max_length=200)
    target_character_id: str | None = Field(default=None, max_length=200)
    reference_asset_ids: list[str] = Field(default_factory=list, max_length=20)
    voice_id: str | None = Field(default=None, max_length=200)
    dialogue_text: str | None = Field(default=None, max_length=8000)
    audio_asset_id: str | None = Field(default=None, max_length=200)
    driving_video_asset_id: str | None = Field(default=None, max_length=200)
    transfer_face_motion: bool = True
    transfer_head_motion: bool = True
    transfer_body_motion: bool = True
    preserve_body_motion: bool = True
    preserve_camera: bool = True
    preserve_wardrobe: bool = True
    consent_confirmed: bool = False
    consent_reference: str | None = Field(default=None, max_length=500)
    metadata: dict[str, object] = Field(default_factory=dict)


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_character_performance_job(
    request: CharacterPerformanceRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        return await queue_character_performance_job(
            _bearer_token(authorization),
            project_id=request.project_id,
            capability=request.capability,
            provider=request.provider,
            source_asset_id=request.source_asset_id,
            target_character_id=request.target_character_id,
            reference_asset_ids=request.reference_asset_ids,
            voice_id=request.voice_id,
            dialogue_text=request.dialogue_text,
            audio_asset_id=request.audio_asset_id,
            driving_video_asset_id=request.driving_video_asset_id,
            transfer_face_motion=request.transfer_face_motion,
            transfer_head_motion=request.transfer_head_motion,
            transfer_body_motion=request.transfer_body_motion,
            preserve_body_motion=request.preserve_body_motion,
            preserve_camera=request.preserve_camera,
            preserve_wardrobe=request.preserve_wardrobe,
            consent_confirmed=request.consent_confirmed,
            consent_reference=request.consent_reference,
            metadata=request.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OrchestrationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
