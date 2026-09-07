"""Character replacement, avatar, performance transfer, voice, and lip-sync orchestration for AI Films."""
from __future__ import annotations

from typing import Any, Literal

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.providers import validate_provider

PerformanceCapability = Literal[
    "avatar",
    "character_replacement",
    "lip_sync",
    "performance_transfer",
    "voice",
]


def _require_consent(consent_confirmed: bool, capability: str) -> None:
    if capability in {"avatar", "character_replacement", "lip_sync", "performance_transfer"} and not consent_confirmed:
        raise OrchestrationError(
            "Explicit likeness/performance consent is required for avatar, character replacement, lip-sync, and performance transfer jobs"
        )


async def queue_character_performance_job(
    access_token: str,
    *,
    project_id: str,
    capability: PerformanceCapability,
    provider: str,
    source_asset_id: str | None = None,
    target_character_id: str | None = None,
    reference_asset_ids: list[str] | None = None,
    voice_id: str | None = None,
    dialogue_text: str | None = None,
    audio_asset_id: str | None = None,
    driving_video_asset_id: str | None = None,
    transfer_face_motion: bool = True,
    transfer_head_motion: bool = True,
    transfer_body_motion: bool = True,
    preserve_body_motion: bool = True,
    preserve_camera: bool = True,
    preserve_wardrobe: bool = True,
    consent_confirmed: bool = False,
    consent_reference: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create an authenticated queued performance job in the existing render queue."""
    _require_consent(consent_confirmed, capability)
    validate_provider(capability, provider)

    if capability in {"character_replacement", "lip_sync"} and not source_asset_id:
        raise OrchestrationError(f"source_asset_id is required for {capability}")
    if capability in {"avatar", "character_replacement", "performance_transfer"} and not target_character_id:
        raise OrchestrationError(f"target_character_id is required for {capability}")
    if capability == "avatar" and not reference_asset_ids:
        raise OrchestrationError("reference_asset_ids are required to create an avatar")
    if capability == "performance_transfer":
        if not driving_video_asset_id:
            raise OrchestrationError("driving_video_asset_id is required for performance_transfer")
        if not (reference_asset_ids or source_asset_id):
            raise OrchestrationError(
                "performance_transfer requires reference_asset_ids or source_asset_id for character identity"
            )
        if not any((transfer_face_motion, transfer_head_motion, transfer_body_motion)):
            raise OrchestrationError("performance_transfer requires at least one enabled motion channel")
    if capability == "lip_sync" and not (audio_asset_id or dialogue_text):
        raise OrchestrationError("lip_sync requires audio_asset_id or dialogue_text")
    if capability == "voice" and not (dialogue_text or audio_asset_id):
        raise OrchestrationError("voice generation requires dialogue_text or audio_asset_id")

    db = SupabaseRLSClient(access_token)
    user = await db.current_user()
    payload = {
        "project_id": project_id,
        "owner_id": user.id,
        "job_type": capability,
        "provider": provider,
        "status": "queued",
        "priority": 25,
        "progress": 0,
        "input": {
            "source_asset_id": source_asset_id,
            "target_character_id": target_character_id,
            "reference_asset_ids": reference_asset_ids or [],
            "voice_id": voice_id,
            "dialogue_text": dialogue_text,
            "audio_asset_id": audio_asset_id,
            "driving_video_asset_id": driving_video_asset_id,
            "motion_transfer": {
                "face": transfer_face_motion,
                "head": transfer_head_motion,
                "body": transfer_body_motion,
            },
            "continuity": {
                "preserve_body_motion": preserve_body_motion,
                "preserve_camera": preserve_camera,
                "preserve_wardrobe": preserve_wardrobe,
            },
            "consent": {
                "confirmed": consent_confirmed,
                "reference": consent_reference,
            },
            "metadata": metadata or {},
        },
        "output": {},
    }
    job = await db.insert("ai_film_render_jobs", payload)
    return {
        "status": "queued",
        "capability": capability,
        "provider": provider,
        "job": job,
    }
