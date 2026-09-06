"""GODMOD3-backed creative location ideation for The Door.

This adapter is intentionally non-authoritative. It generates structured creative
candidates only; gameplay, save state, progression, and Unreal runtime systems
remain deterministic and governed by D3VONN/The Door.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/game-dev", tags=["game-dev", "godmod3"])

GODS_EYE_VIEW_REPO_URL = "https://github.com/bilawalsidhu/gods-eye-view"
GODS_EYE_VIEW_MEDIA_REFERENCE_URL = (
    "https://github.com/bilawalsidhu/gods-eye-view/blob/main/"
    "docs/media/hero-open-source-reveal.gif"
)

RealityName = Literal["Normal", "Echo", "Fractured", "Convergence", "Any"]
LocationType = Literal[
    "exploration",
    "door-threshold",
    "combat-arena",
    "boss-arena",
    "impossible-space",
    "puzzle",
    "narrative",
    "traversal",
    "hybrid",
]


class LocationIdeasRequest(BaseModel):
    project_context: str = Field(
        default=(
            "The Door is a prestige sci-fi/metaphysical action-adventure built around "
            "Doors, Foresight, reality shifts, impossible architecture, deterministic "
            "encounters, exploration, and environmental storytelling."
        ),
        min_length=20,
        max_length=4000,
    )
    chapter_id: str | None = Field(default=None, max_length=80)
    reality: RealityName = "Any"
    location_type: LocationType = "hybrid"
    count: int = Field(default=6, ge=1, le=12)
    constraints: list[str] = Field(default_factory=list, max_length=20)
    required_elements: list[str] = Field(default_factory=list, max_length=20)
    forbidden_elements: list[str] = Field(default_factory=list, max_length=20)
    tone: str = Field(default="mysterious, cinematic, playable, readable", max_length=300)


class LocationSceneDeployment(BaseModel):
    """Non-authoritative visual deployment plan for staging a location reveal."""

    reveal_style: str = "god-eye-spatial-reveal"
    camera_path: list[str] = Field(default_factory=list)
    spatial_layers: list[str] = Field(default_factory=list)
    transition_cue: str
    player_handoff: str
    implementation_reference: str = GODS_EYE_VIEW_REPO_URL
    media_reference: str = GODS_EYE_VIEW_MEDIA_REFERENCE_URL
    reuse_policy: str = (
        "Use the MIT-licensed God's Eye View codebase only as an implementation/design "
        "reference. Do not copy, bundle, modify, or commercially reuse the referenced "
        "hero GIF without separate permission from its owner."
    )


class LocationIdea(BaseModel):
    id: str
    name: str
    elevator_pitch: str
    reality: str
    location_type: str
    visual_identity: list[str] = Field(default_factory=list)
    door_mechanic: str
    foresight_hook: str
    traversal_hook: str
    encounter_hook: str
    narrative_purpose: str
    audio_hook: str
    scene_deployment: LocationSceneDeployment
    gameplay_risks: list[str] = Field(default_factory=list)
    production_notes: list[str] = Field(default_factory=list)


class LocationIdeasResponse(BaseModel):
    source: str = "godmod3"
    model: str
    authoritative: bool = False
    ideas: list[LocationIdea]


def _config() -> tuple[str, str, str]:
    base_url = os.getenv("GODMOD3_API_BASE_URL", "").strip().rstrip("/")
    api_key = os.getenv("GODMOD3_API_KEY", "").strip()
    model = os.getenv("GODMOD3_MODEL", "ultraplinian").strip() or "ultraplinian"
    if not base_url or not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GODMOD3 location ideation is not configured. Set "
                "GODMOD3_API_BASE_URL and GODMOD3_API_KEY on the backend."
            ),
        )
    return base_url, api_key, model


def _system_prompt() -> str:
    return (
        "You are the location concept cell for The Door game-development pipeline. "
        "Generate original, playable location concepts for Unreal Engine production. "
        "Treat your output as non-authoritative ideation: never change canon, mission "
        "state, progression, save state, encounter completion, or runtime rules. "
        "Prioritize strong spatial identity, Door/reality logic, Foresight utility, "
        "traversal readability, combat readability, environmental storytelling, and "
        "reasonable production scope. Every location must include a scene_deployment "
        "plan inspired by the open-source God's Eye View spatial/cinematic grammar: "
        "begin with readable geographic/spatial context, progressively reveal relevant "
        "layers or landmarks, move through a purposeful camera path, and hand control "
        "back to the player cleanly. Treat God's Eye View as an implementation/design "
        "reference only. Do not copy, reproduce, modify, or redistribute its referenced "
        "hero GIF or other separately licensed promotional media. Return JSON only, "
        "with no markdown fences."
    )


def _user_prompt(request: LocationIdeasRequest) -> str:
    schema = {
        "ideas": [
            {
                "id": "LOC_CHXX_001",
                "name": "string",
                "elevator_pitch": "string",
                "reality": "Normal|Echo|Fractured|Convergence|Mixed",
                "location_type": "string",
                "visual_identity": ["string"],
                "door_mechanic": "string",
                "foresight_hook": "string",
                "traversal_hook": "string",
                "encounter_hook": "string",
                "narrative_purpose": "string",
                "audio_hook": "string",
                "scene_deployment": {
                    "reveal_style": "god-eye-spatial-reveal",
                    "camera_path": [
                        "establish spatial context",
                        "descend toward the playable location",
                        "frame Door/landmark",
                    ],
                    "spatial_layers": [
                        "terrain or architecture",
                        "Door/reality signal",
                        "gameplay landmarks",
                    ],
                    "transition_cue": "string",
                    "player_handoff": "string",
                    "implementation_reference": GODS_EYE_VIEW_REPO_URL,
                    "media_reference": GODS_EYE_VIEW_MEDIA_REFERENCE_URL,
                    "reuse_policy": (
                        "Reference only; do not copy/bundle/modify the hero GIF without "
                        "separate permission."
                    ),
                },
                "gameplay_risks": ["string"],
                "production_notes": ["string"],
            }
        ]
    }
    payload = {
        "project_context": request.project_context,
        "chapter_id": request.chapter_id,
        "reality": request.reality,
        "location_type": request.location_type,
        "count": request.count,
        "tone": request.tone,
        "constraints": request.constraints,
        "required_elements": request.required_elements,
        "forbidden_elements": request.forbidden_elements,
        "scene_deployment_reference": {
            "project": "God's Eye View",
            "repository": GODS_EYE_VIEW_REPO_URL,
            "hero_media_reference": GODS_EYE_VIEW_MEDIA_REFERENCE_URL,
            "intent": (
                "Adapt the open-source project's spatial reveal and scene-director ideas "
                "for The Door; never redistribute the separately licensed hero GIF."
            ),
        },
    }
    return (
        "Generate location ideas from this brief:\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Return exactly this JSON shape and produce exactly the requested number of ideas:\n"
        f"{json.dumps(schema, ensure_ascii=False)}"
    )


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("GODMOD3 did not return a JSON object")
        parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("GODMOD3 response root must be an object")
    return parsed


@router.post("/location-ideas", response_model=LocationIdeasResponse)
async def generate_location_ideas(
    request: LocationIdeasRequest,
    _user_id: str = Depends(get_current_user_id),
) -> LocationIdeasResponse:
    """Generate structured, non-authoritative location concepts with GODMOD3."""
    base_url, api_key, model = _config()
    endpoint = f"{base_url}/v1/chat/completions"
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": _user_prompt(request)},
        ],
        "temperature": 0.9,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.post(endpoint, json=body, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GODMOD3 request failed: {exc.__class__.__name__}",
        ) from exc

    if upstream.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GODMOD3 returned HTTP {upstream.status_code}",
        )

    try:
        payload = upstream.json()
        content = payload["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise TypeError("message content is not text")
        parsed = _extract_json(content)
        ideas_raw = parsed.get("ideas")
        if not isinstance(ideas_raw, list):
            raise ValueError("missing ideas array")
        ideas = [LocationIdea.model_validate(item) for item in ideas_raw]
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GODMOD3 returned an invalid location-ideas payload",
        ) from exc

    if len(ideas) != request.count:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"GODMOD3 returned {len(ideas)} ideas; expected exactly {request.count}."
            ),
        )

    return LocationIdeasResponse(model=model, ideas=ideas)
