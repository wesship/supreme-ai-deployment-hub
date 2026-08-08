"""Authenticated AI Director / Movie Assembly API."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from backend.ai_films.director import (
    ClipSpec,
    build_director_plan,
    generate_cmx_edl,
    normalize_timeline,
)
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.providers import validate_provider

router = APIRouter(prefix="/ai-films/director", tags=["ai-films", "ai-director"])


class DirectorClip(BaseModel):
    asset_id: str = Field(..., min_length=1, max_length=200)
    label: str = Field(..., min_length=1, max_length=240)
    duration_seconds: float = Field(..., gt=0, le=21600)
    source_in: float = Field(default=0, ge=0)
    source_out: float | None = Field(default=None, gt=0)
    summary: str | None = Field(default=None, max_length=2000)
    characters: list[str] = Field(default_factory=list, max_length=30)
    dialogue: str | None = Field(default=None, max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def validate_range(self):
        end = self.source_out if self.source_out is not None else self.duration_seconds
        if end > self.duration_seconds:
            raise ValueError("source_out cannot exceed duration_seconds")
        if end <= self.source_in:
            raise ValueError("source_out must be greater than source_in")
        return self


class DirectorAudioTrack(BaseModel):
    asset_id: str = Field(..., min_length=1, max_length=200)
    kind: Literal["dialogue", "music", "sfx"]
    timeline_start: float = Field(default=0, ge=0, le=21600)
    source_in: float = Field(default=0, ge=0, le=21600)
    source_out: float | None = Field(default=None, gt=0, le=21600)
    gain_db: float = Field(default=0, ge=-60, le=12)
    label: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def validate_range(self):
        if self.source_out is not None and self.source_out <= self.source_in:
            raise ValueError("audio source_out must be greater than source_in")
        return self


class DirectorSubtitleCue(BaseModel):
    start: float = Field(..., ge=0, le=21600)
    end: float = Field(..., gt=0, le=21600)
    text: str = Field(..., min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end <= self.start:
            raise ValueError("subtitle end must be greater than start")
        return self


class DirectorAssemblyRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=2, max_length=200)
    clips: list[DirectorClip] = Field(..., min_length=1, max_length=200)
    structure: Literal["narrative", "trailer", "teaser", "episode", "montage"] = "narrative"
    tone: str | None = Field(default=None, max_length=500)
    target_runtime_seconds: float | None = Field(default=None, gt=0, le=21600)
    fps: Literal[23, 24, 25, 30, 60] = 24
    resolution: Literal["1920x1080", "3840x2160", "1080x1920"] = "1920x1080"
    aspect_ratio: Literal["16:9", "9:16", "2.39:1", "1.85:1"] = "16:9"
    include_dialogue: bool = True
    include_music: bool = True
    include_sfx: bool = True
    include_subtitles: bool = True
    audio_tracks: list[DirectorAudioTrack] = Field(default_factory=list, max_length=200)
    subtitle_cues: list[DirectorSubtitleCue] = Field(default_factory=list, max_length=2000)
    run_continuity_qa: bool = True
    run_final_analyze_qa: bool = True


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is empty")
    return token


@router.post("/assemble", status_code=status.HTTP_201_CREATED)
async def assemble_movie(
    request: DirectorAssemblyRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Plan and queue a continuity-aware movie assembly without spending render credits inline."""
    access_token = _token(authorization)
    db = SupabaseRLSClient(access_token)
    try:
        user = await db.current_user()
        validate_provider("assembly", "ffmpeg")
    except (OrchestrationError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=401 if isinstance(exc, OrchestrationError) else 503, detail=str(exc)) from exc

    clips = [
        ClipSpec(
            asset_id=c.asset_id,
            label=c.label,
            duration_seconds=c.duration_seconds,
            source_in=c.source_in,
            source_out=c.source_out,
            summary=c.summary,
            characters=tuple(c.characters),
            dialogue=c.dialogue,
            tags=tuple(c.tags),
        )
        for c in request.clips
    ]

    plan, reasoning = await build_director_plan(
        clips,
        title=request.title,
        target_runtime_seconds=request.target_runtime_seconds,
        tone=request.tone,
        structure=request.structure,
    )
    timeline = normalize_timeline(plan, clips)
    edl = generate_cmx_edl(timeline, request.title, fps=request.fps)
    runtime = round(sum(float(item["duration"]) for item in timeline), 3)

    enabled_kinds = {
        "dialogue": request.include_dialogue,
        "music": request.include_music,
        "sfx": request.include_sfx,
    }
    audio_tracks = [
        track.model_dump()
        for track in request.audio_tracks
        if enabled_kinds.get(track.kind, False)
    ]
    subtitle_cues = [cue.model_dump() for cue in request.subtitle_cues] if request.include_subtitles else []

    job_input = {
        "director_version": "v1.1",
        "title": request.title,
        "structure": request.structure,
        "tone": request.tone,
        "timeline": timeline,
        "edl": edl,
        "audio_cues": plan.get("audio_cues", []),
        "audio_tracks": audio_tracks,
        "subtitle_cues": subtitle_cues,
        "continuity_flags": plan.get("continuity_flags", []),
        "missing_shots": plan.get("missing_shots", []),
        "editorial_intent": plan.get("editorial_intent"),
        "reasoning": reasoning,
        "target_runtime_seconds": request.target_runtime_seconds,
        "planned_runtime_seconds": runtime,
        "fps": request.fps,
        "resolution": request.resolution,
        "aspect_ratio": request.aspect_ratio,
        "tracks": {
            "dialogue": request.include_dialogue,
            "music": request.include_music,
            "sfx": request.include_sfx,
            "subtitles": request.include_subtitles,
        },
        "qa": {
            "continuity": request.run_continuity_qa,
            "final_twelvelabs_analyze": request.run_final_analyze_qa,
            "jockey_corpus_reasoning": True,
        },
    }

    try:
        job = await db.insert(
            "ai_film_render_jobs",
            {
                "project_id": request.project_id,
                "owner_id": user.id,
                "job_type": "assembly",
                "provider": "ffmpeg",
                "status": "queued",
                "priority": 90,
                "progress": 0,
                "input": job_input,
                "output": {},
            },
        )
        event = await db.insert(
            "ai_film_activity_events",
            {
                "project_id": request.project_id,
                "owner_id": user.id,
                "actor_id": user.id,
                "event_type": "director.assembly_queued",
                "target_type": "render_job",
                "target_id": job["id"],
                "summary": f"AI Director queued {len(timeline)} clips for movie assembly",
                "metadata": {
                    "planned_runtime_seconds": runtime,
                    "reasoning_status": reasoning.get("status"),
                    "continuity_flag_count": len(plan.get("continuity_flags", [])),
                    "missing_shot_count": len(plan.get("missing_shots", [])),
                    "audio_track_count": len(audio_tracks),
                    "subtitle_cue_count": len(subtitle_cues),
                },
            },
        )
    except OrchestrationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "status": "queued",
        "director": "jockey+deterministic-timeline",
        "project_id": request.project_id,
        "render_job": job,
        "activity_event": event,
        "reasoning": reasoning,
        "planned_runtime_seconds": runtime,
        "timeline": timeline,
        "edl": edl,
        "continuity_flags": plan.get("continuity_flags", []),
        "missing_shots": plan.get("missing_shots", []),
        "audio_cues": plan.get("audio_cues", []),
        "audio_track_count": len(audio_tracks),
        "subtitle_cue_count": len(subtitle_cues),
    }
