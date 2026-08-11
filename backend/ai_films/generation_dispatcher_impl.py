"""Multimodel generation routing for AI Films Shot Manifest gaps."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Mapping

from backend.ai_films.providers import provider_specs
from backend.ai_films.production_bible import ProductionBible, ShotManifestItem
from backend.ai_films.shot_compiler import build_generation_packet


@dataclass(frozen=True)
class VideoRoute:
    provider: str
    configured: bool
    dispatchable: bool
    score: int
    reasons: tuple[str, ...]
    model: str | None = None


_VIDEO_MODEL_ENV = {
    "openai": "AI_FILM_OPENAI_VIDEO_MODEL",
    "higgsfield": "AI_FILM_HIGGSFIELD_VIDEO_MODEL",
    "xai": "AI_FILM_XAI_VIDEO_MODEL",
    "movieflow": "AI_FILM_MOVIEFLOW_VIDEO_MODEL",
    "runway": "AI_FILM_RUNWAY_MODEL",
    "replicate": "AI_FILM_REPLICATE_VIDEO_MODEL",
    "kling": "AI_FILM_KLING_VIDEO_MODEL",
    "invideo": "AI_FILM_INVIDEO_VIDEO_MODEL",
}
_PROVIDER_ALIASES = {"sora": "openai", "grok": "xai", "xai": "xai", "openai": "openai", "kling.ai": "kling", "invideo.ai": "invideo"}
_BASE_SCORE = {"openai": 100, "higgsfield": 95, "kling": 92, "runway": 88, "xai": 84, "movieflow": 82, "invideo": 78, "replicate": 72}


def _video_specs(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    return {spec.provider: spec for spec in provider_specs(environ) if spec.capability == "video"}


def _normalize_provider(value: str) -> str:
    cleaned = str(value).strip().lower()
    return _PROVIDER_ALIASES.get(cleaned, cleaned)


def _executor_providers(environ: Mapping[str, str]) -> set[str]:
    """Return providers with an installed video execution worker/bridge.

    OpenAI is the only built-in executor currently present in the repository.
    Additional providers must be explicitly registered after their worker or
    governed bridge is deployed, preventing configured-but-unexecutable jobs
    from being queued indefinitely.
    """
    raw = str(environ.get("AI_FILM_VIDEO_EXECUTOR_PROVIDERS", "openai"))
    return {_normalize_provider(item) for item in raw.split(",") if item.strip()}


def rank_video_routes(packet: Mapping[str, Any], environ: Mapping[str, str] | None = None) -> list[VideoRoute]:
    source = environ or os.environ
    specs = _video_specs(source)
    executors = _executor_providers(source)
    raw_pref = packet.get("provider_route")
    preferred = [_normalize_provider(v) for v in raw_pref] if isinstance(raw_pref, list) else []
    anchors = packet.get("anchor_frame_asset_ids") or []
    audio = packet.get("audio") if isinstance(packet.get("audio"), dict) else {}
    dialogue = bool(audio.get("dialogue"))
    character_locks = packet.get("character_locks") or {}
    routes: list[VideoRoute] = []
    for provider, spec in specs.items():
        configured = spec.configured(source)
        dispatchable = provider in executors
        score = _BASE_SCORE.get(provider, 50)
        reasons: list[str] = []
        if preferred:
            if provider in preferred:
                score += max(4, 24 - preferred.index(provider) * 4)
                reasons.append("preferred_by_manifest")
            else:
                score -= 10
        if anchors and provider in {"openai", "higgsfield", "kling", "runway", "replicate"}:
            score += 8
            reasons.append("anchor_frame_fit")
        if character_locks and provider in {"openai", "higgsfield", "kling", "runway"}:
            score += 7
            reasons.append("character_continuity_fit")
        if dialogue:
            if provider in {"openai", "xai"}:
                score += 5
                reasons.append("synced_audio_fit")
            else:
                reasons.append("dialogue_requires_post_lipsync")
        if not configured:
            score -= 1000
            missing = [name for name in spec.required_env if not str(source.get(name, "")).strip()]
            reasons.append("not_configured:" + ",".join(missing))
        else:
            reasons.append("configured")
        reasons.append("executor_registered" if dispatchable else "executor_not_registered")
        model_env = spec.model_env or _VIDEO_MODEL_ENV.get(provider)
        model = str(source.get(model_env, "")).strip() if model_env else ""
        routes.append(VideoRoute(provider, configured, dispatchable, score, tuple(reasons), model or None))
    return sorted(routes, key=lambda route: (-route.score, route.provider))


def _anchor_block(packet: Mapping[str, Any], bible: ProductionBible) -> tuple[str | None, list[str]]:
    if not bool(bible.generation_policy.get("require_anchor_frames")):
        return None, []
    shot_anchors = packet.get("anchor_frame_asset_ids")
    if isinstance(shot_anchors, list) and shot_anchors:
        return None, []
    locks = packet.get("character_locks") if isinstance(packet.get("character_locks"), dict) else {}
    character_ids = sorted(str(v) for v in locks.keys())
    if len(character_ids) > 1:
        return "composite_anchor_required", character_ids
    missing: list[str] = []
    for character_id, lock in locks.items():
        anchors = lock.get("anchor_asset_ids") if isinstance(lock, dict) else None
        if not isinstance(anchors, list) or not anchors:
            missing.append(str(character_id))
    return ("anchor_frames_required" if missing else None), sorted(set(missing))


def _route_payload(route: VideoRoute) -> dict[str, Any]:
    return {
        "provider": route.provider,
        "configured": route.configured,
        "dispatchable": route.dispatchable,
        "score": route.score,
        "model": route.model,
        "reasons": list(route.reasons),
    }


def dispatch_plan(shot: ShotManifestItem, bible: ProductionBible, *, conform_decision: str, environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    if conform_decision != "generate":
        return {"shot_id": shot.shot_id, "action": "hold", "reason": f"conform_decision:{conform_decision}", "routes": []}
    packet = build_generation_packet(shot, bible)
    routes = rank_video_routes(packet, environ)
    block_reason, missing_anchors = _anchor_block(packet, bible)
    if block_reason:
        return {
            "shot_id": shot.shot_id,
            "action": "blocked",
            "reason": block_reason,
            "missing_anchor_characters": missing_anchors,
            "selected_provider": None,
            "selected_model": None,
            "generation_packet": packet,
            "routes": [_route_payload(route) for route in routes],
        }
    executable = [route for route in routes if route.configured and route.dispatchable]
    selected = executable[0] if executable else None
    configured = [route for route in routes if route.configured]
    reason = "provider_selected" if selected else (
        "configured_provider_has_no_executor" if configured else "no_configured_video_provider"
    )
    return {
        "shot_id": shot.shot_id,
        "action": "queue" if selected else "blocked",
        "reason": reason,
        "selected_provider": selected.provider if selected else None,
        "selected_model": selected.model if selected else None,
        "generation_packet": packet,
        "routes": [_route_payload(route) for route in routes],
    }
