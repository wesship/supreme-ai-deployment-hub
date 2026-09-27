"""Authenticated scene-finder and production-blueprint surface for D3VONN.IO AI Films."""
from __future__ import annotations

import json
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend.ai_films.openmontage_router import OpenMontageDispatchRequest, dispatch_openmontage
from backend.ai_films.router import _require_authenticated_user
from backend.ai_films.twelvelabs import TwelveLabsError
from backend.ai_films.twelvelabs_analyze import TwelveLabsAnalyzeClient
from backend.ai_films.twelvelabs_index import TwelveLabsIndexClient

router = APIRouter(
    prefix="/ai-films/scene-finder",
    tags=["ai-films", "scene-finder"],
)


class SceneFinderSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    page_limit: int = Field(default=12, ge=1, le=50)
    search_options: list[Literal["visual", "audio", "transcription"]] = Field(
        default_factory=lambda: ["visual", "audio", "transcription"],
        min_length=1,
        max_length=3,
    )
    operator: Literal["or", "and"] = "or"


class SceneBlueprintRequest(BaseModel):
    asset_id: str = Field(..., min_length=1, max_length=200)
    objective: str = Field(..., min_length=2, max_length=1500)
    start_time: float | None = Field(default=None, ge=0.0)
    end_time: float | None = Field(default=None, gt=0.0)
    model_name: Literal["pegasus1.5"] = "pegasus1.5"

    @model_validator(mode="after")
    def validate_window(self):
        if self.start_time is not None and self.end_time is not None:
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be greater than start_time")
            if self.end_time - self.start_time < 4:
                raise ValueError("Scene blueprint windows must be at least 4 seconds")
        return self


class SceneProductionRequest(SceneBlueprintRequest):
    duration_seconds: int = Field(default=8, ge=4, le=20)
    aspect_ratio: Literal["16:9", "9:16", "4:5"] = "16:9"


def _scene_hits(result: dict[str, Any]) -> list[dict[str, Any]]:
    data = result.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    clips = result.get("clips")
    if isinstance(clips, list):
        return [item for item in clips if isinstance(item, dict)]
    return []


def _blueprint_prompt(objective: str) -> str:
    return f"""
You are D3VONN.IO Scene Intelligence. Analyze this reference clip for filmmaking technique.

Production objective:
{objective}

Return a concise production blueprint with these sections:
1. Scene summary
2. Shot size and composition
3. Camera position, movement, and estimated lens behavior
4. Actor blocking and subject movement
5. Lighting direction, contrast, practicals, and palette
6. Production design and environment
7. Editing rhythm and approximate shot-duration pattern
8. Sound-design and music characteristics
9. VFX/SFX techniques if visible
10. Narrative or emotional function
11. Reusable Scene DNA tags
12. Original adaptation plan for a new D3VONN.IO production

Important:
- Extract general filmmaking techniques, not protected expression.
- Do not reproduce copyrighted dialogue.
- Do not recommend copying a unique character identity, logo, costume, set, or exact shot sequence.
- The adaptation plan must be materially original while preserving only general cinematic techniques.
""".strip()


def _result_text(result: Any) -> str:
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        for key in ("text", "output", "result", "content"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return json.dumps(result, ensure_ascii=False, separators=(",", ":"))


def _production_prompt(objective: str, blueprint: Any) -> str:
    technique = _result_text(blueprint)[:8000]
    return (
        "Create a materially original cinematic scene using only general filmmaking techniques from the reference analysis. "
        f"Original production objective: {objective.strip()}\n\n"
        f"General Scene DNA reference:\n{technique}\n\n"
        "Do not reproduce copyrighted dialogue, distinctive characters, names, logos, costumes, proprietary set design, "
        "music, or the exact shot sequence from the source. Change the environment, blocking, visual details, and narrative expression. "
        "Preserve only general craft attributes such as camera movement, lens behavior, lighting strategy, pacing, composition, and sound-design principles."
    )[:12000]


@router.post("/search")
async def search_scenes(
    request: SceneFinderSearchRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    await _require_authenticated_user(authorization)
    client = TwelveLabsIndexClient()
    try:
        result = await client.search(
            request.query,
            page_limit=request.page_limit,
            search_options=tuple(request.search_options),
            transcription_options=("lexical", "semantic"),
            group_by="clip",
            operator=request.operator,
            include_user_metadata=True,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "provider": "twelvelabs",
        "surface": "scene-finder",
        "query": request.query,
        "count": len(_scene_hits(result)),
        "scenes": _scene_hits(result),
        "raw": result,
    }


@router.post("/blueprint")
async def create_scene_blueprint(
    request: SceneBlueprintRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    await _require_authenticated_user(authorization)
    client = TwelveLabsAnalyzeClient()
    prompt = _blueprint_prompt(request.objective)
    try:
        result = await client.analyze_asset(
            request.asset_id,
            prompt,
            model_name=request.model_name,
            temperature=0.2,
            max_tokens=4096,
            start_time=request.start_time,
            end_time=request.end_time,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "provider": "twelvelabs",
        "surface": "scene-blueprint",
        "asset_id": request.asset_id,
        "objective": request.objective,
        "window": {
            "start_time": request.start_time,
            "end_time": request.end_time,
        },
        "result": result,
    }


@router.post("/production-handoff", status_code=202)
async def production_handoff(
    request: SceneProductionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Analyze a reference and queue an original governed OpenMontage production."""
    await _require_authenticated_user(authorization)
    client = TwelveLabsAnalyzeClient()
    try:
        blueprint = await client.analyze_asset(
            request.asset_id,
            _blueprint_prompt(request.objective),
            model_name=request.model_name,
            temperature=0.2,
            max_tokens=4096,
            start_time=request.start_time,
            end_time=request.end_time,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    dispatch = await dispatch_openmontage(
        OpenMontageDispatchRequest(
            job_id=f"scene-finder-{uuid.uuid4().hex[:16]}",
            idea=request.objective.strip(),
            screenplay=(
                "Original scene treatment generated from generalized Scene DNA. "
                + request.objective.strip()
            )[:30000],
            video_prompt=_production_prompt(request.objective, blueprint),
            duration_seconds=request.duration_seconds,
            aspect_ratio=request.aspect_ratio,
        ),
        authorization=authorization,
    )
    return {
        "status": "queued",
        "surface": "scene-finder-production",
        "reference_asset_id": request.asset_id,
        "reference_window": {
            "start_time": request.start_time,
            "end_time": request.end_time,
        },
        "originality_policy": "general-technique-only",
        "production": dispatch,
    }
