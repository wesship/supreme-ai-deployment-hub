"""Authenticated OpenMontage bridge for real AI Films render execution.

This router creates a small but complete, owner-scoped production package from an
approved screenplay.  It intentionally queues only the OpenAI/Sora route because
that is the provider with a production worker in this deployment.  Every job is
backed by a production bible and shot manifest so post-render TwelveLabs/Jockey
review can operate on the same project rather than a sample-video fallback.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.assembly_qa_worker import _sign_master
from backend.ai_films.assembly_worker import AssemblyWorkerError, SupabaseAssemblyClient
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

router = APIRouter(prefix="/ai-films/openmontage", tags=["ai-films", "openmontage"])

STAGE_NAMES = ("research", "script", "storyboard", "assets", "narration", "render", "review", "publish")


class OpenMontageDispatchRequest(BaseModel):
    job_id: str = Field(..., min_length=1, max_length=128)
    idea: str = Field(..., min_length=3, max_length=5000)
    screenplay: str = Field(..., min_length=20, max_length=30000)
    video_prompt: str = Field(..., min_length=10, max_length=12000)
    duration_seconds: int = Field(default=8, ge=4, le=20)


class OpenMontageStatusResponse(BaseModel):
    render_job_id: str
    project_id: str
    provider: str
    provider_job_id: str | None = None
    status: str
    stages: list[dict[str, str]]
    video_url: str | None = None
    review_state: str | None = None
    error: str | None = None


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is empty")
    return token


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stages(active: str, *, terminal: bool = False, failed: bool = False) -> list[dict[str, str]]:
    if terminal and not failed:
        return [{"name": name, "status": "completed", "updatedAt": _now()} for name in STAGE_NAMES]
    active_index = STAGE_NAMES.index(active) if active in STAGE_NAMES else STAGE_NAMES.index("render")
    result: list[dict[str, str]] = []
    for index, name in enumerate(STAGE_NAMES):
        state = "completed" if index < active_index else "running" if index == active_index else "pending"
        if failed and index == active_index:
            state = "failed"
        result.append({"name": name, "status": state, "updatedAt": _now()})
    return result


def _production_bible(title: str, screenplay: str) -> dict[str, Any]:
    return {
        "version": 1,
        "title": title,
        "canon_rules": [
            "The approved screenplay is the source of truth for story, setting, and tone.",
            "Do not introduce real people, copyrighted characters, or unlicensed music.",
            "Flag uncertainty during review rather than inventing facts or continuity.",
        ],
        "characters": [],
        "events": [{"id": "openmontage-approved-screenplay", "summary": screenplay[:4000]}],
        "generation_policy": {
            "require_anchor_frames": False,
            "review_before_publish": True,
            "provider": "openai",
        },
    }


async def _select_owned_render_job(access_token: str, job_id: str) -> tuple[dict[str, Any], str]:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="OpenMontage persistence is not configured")
    headers = {"apikey": anon_key, "Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{base_url}/rest/v1/ai_film_render_jobs",
                headers=headers,
                params={"id": f"eq.{job_id}", "select": "id,project_id,provider,status,output,error_message" , "limit": "1"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="OpenMontage status service is unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="OpenMontage status lookup failed")
    rows = response.json()
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="OpenMontage render job was not found")
    return rows[0], base_url


@router.post("/dispatch", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_openmontage(
    request: OpenMontageDispatchRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Persist a governed production package and queue a real OpenAI video job."""
    token = _bearer_token(authorization)
    db = SupabaseRLSClient(token)
    try:
        user = await db.current_user()
        run_id = uuid.uuid4().hex[:12]
        title = f"OpenMontage — {request.idea[:72].strip()}"
        project = await db.insert(
            "ai_film_projects",
            {
                "owner_id": user.id,
                "slug": f"openmontage-{run_id}",
                "title": title,
                "description": request.idea,
                "format": "scene",
                "status": "in_production",
                "metadata": {
                    "openmontage_job_id": request.job_id,
                    "source": "openmontage-edge-dispatch",
                    "render_provider": "openai",
                    "created_at": _now(),
                },
            },
        )
        project_id = str(project["id"])
        scene = await db.insert(
            "ai_film_scenes",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "scene_number": 1,
                "title": "OpenMontage Generated Scene",
                "location": "UNSPECIFIED — GENERATED FROM APPROVED SCREENPLAY",
                "synopsis": request.idea,
                "screenplay": request.screenplay,
                "production_package": {"source": "openmontage", "generation_prompt": request.video_prompt},
                "canon_validation": {"status": "pending", "violations": []},
                "status": "approved",
            },
        )
        storyboard = await db.insert(
            "ai_film_storyboards",
            {
                "project_id": project_id,
                "scene_id": scene["id"],
                "owner_id": user.id,
                "title": "OpenMontage Storyboard",
                "status": "approved",
                "style_prompt": request.video_prompt[:4000],
                "frame_count": 1,
                "metadata": {"source": "openmontage"},
            },
        )
        shot_id = f"om-{run_id}-001"
        shot = await db.insert(
            "ai_film_shots",
            {
                "storyboard_id": storyboard["id"],
                "project_id": project_id,
                "scene_id": scene["id"],
                "owner_id": user.id,
                "shot_number": 1,
                "shot_type": "master",
                "description": request.idea,
                "camera_angle": "director-selected",
                "camera_movement": "director-selected",
                "lens": "cinematic",
                "duration_seconds": float(request.duration_seconds),
                "lighting": "as specified by generation prompt",
                "blocking": "as specified by approved screenplay",
                "image_prompt": request.video_prompt,
                "status": "planned",
                "metadata": {"openmontage_shot_id": shot_id},
            },
        )
        bible = _production_bible(title, request.screenplay)
        await db.insert(
            "ai_film_production_bibles",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "version": 1,
                "status": "active",
                "bible": bible,
            },
        )
        packet = {
            "shot_id": shot_id,
            "generation_prompt": request.video_prompt,
            "negative_prompt": "copyrighted characters, real people, unlicensed logos, unreadable text",
            "duration_target_seconds": request.duration_seconds,
            "provider_route": ["openai"],
            "anchor_frame_asset_ids": [],
            "character_locks": {},
            "continuity_locks": ["Follow the approved screenplay and production bible."],
            "camera": {"direction": "Follow the approved cinematic prompt"},
            "lighting": {"direction": "Follow the approved cinematic prompt"},
            "audio": {"dialogue": False},
        }
        await db.insert(
            "ai_film_shot_manifests",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "bible_version": 1,
                "manifest_version": 1,
                "title": "OpenMontage Active Shot Manifest",
                "structure": "scene",
                "status": "active",
                "manifest": {"version": 1, "shots": [{"shot_id": shot_id, "scene_id": str(scene["id"]), "shot_db_id": str(shot["id"]), "qa_state": "pending", "generation_packet": packet}]},
            },
        )
        render_job = await db.insert(
            "ai_film_render_jobs",
            {
                "project_id": project_id,
                "scene_id": scene["id"],
                "owner_id": user.id,
                "job_type": "video",
                "provider": "openai",
                "status": "queued",
                "priority": 75,
                "progress": 0,
                "input": {"shot_id": shot_id, "generation_packet": packet, "openmontage_job_id": request.job_id},
                "output": {"openmontage": {"job_id": request.job_id, "stages": _stages("render")}},
            },
        )
    except OrchestrationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "project_id": project_id,
        "render_job_id": str(render_job["id"]),
        "provider": "openai",
        "status": "queued",
        "stages": _stages("render"),
    }


@router.get("/jobs/{render_job_id}", response_model=OpenMontageStatusResponse)
async def get_openmontage_job(
    render_job_id: str,
    authorization: str | None = Header(default=None),
) -> OpenMontageStatusResponse:
    """Return owner-authorized render state and a short-lived playback URL when available."""
    token = _bearer_token(authorization)
    job, _ = await _select_owned_render_job(token, render_job_id)
    output = job.get("output") if isinstance(job.get("output"), dict) else {}
    qa = output.get("qa") if isinstance(output.get("qa"), dict) else {}
    raw_status = str(job.get("status") or "queued")
    qa_state = str(qa.get("state") or "") or None
    provider_job_id = str(output.get("provider_job_id") or "") or None
    video_url: str | None = None
    error = str(job.get("error_message") or "") or None

    if raw_status in {"failed", "cancelled", "blocked"}:
        pipeline_status = "failed"
        stages = _stages("render", failed=True)
    elif raw_status in {"queued", "running", "processing"}:
        pipeline_status = "render"
        stages = _stages("render")
    elif qa_state in {"pending_generated_qa", "in_progress"}:
        pipeline_status = "review"
        stages = _stages("review")
    elif qa_state in {"revise", "block", "failed"}:
        pipeline_status = "review"
        stages = _stages("review", failed=qa_state == "failed")
    else:
        pipeline_status = "completed"
        stages = _stages("publish", terminal=True)

    object_path = str(output.get("object_path") or "")
    if object_path:
        try:
            video_url = await _sign_master(SupabaseAssemblyClient(), object_path, expires_in=900)
        except (AssemblyWorkerError, RuntimeError):
            error = error or "Rendered media is stored but a playback URL could not be issued."

    return OpenMontageStatusResponse(
        render_job_id=str(job["id"]),
        project_id=str(job["project_id"]),
        provider=str(job.get("provider") or "openai"),
        provider_job_id=provider_job_id,
        status=pipeline_status,
        stages=stages,
        video_url=video_url,
        review_state=qa_state,
        error=error,
    )
