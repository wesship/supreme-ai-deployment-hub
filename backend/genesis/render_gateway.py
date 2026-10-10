"""Provider-neutral routing and cost controls for the Genesis render gateway.

This module intentionally keeps provider API calls behind adapters. The first vertical
slice supports governed route discovery, deterministic estimates, manual-provider
fallback, and durable job creation without exposing provider credentials to agents.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .schemas import RenderEstimate


@dataclass(frozen=True)
class ProviderRoute:
    provider: str
    model: str
    capabilities: frozenset[str]
    quality: float
    reliability: float
    speed: float
    cost_factor: float
    configured: bool
    manual: bool = False


BASE_UNIT_COSTS: dict[str, float] = {
    "text": 0.10,
    "image": 0.08,
    "video": 0.80,
    "audio": 0.04,
    "three_d": 2.50,
    "postproduction": 0.50,
}

PROFILE_WEIGHTS: dict[str, dict[str, float]] = {
    "quality_first": {"quality": 0.45, "reliability": 0.25, "speed": 0.10, "cost": 0.20},
    "balanced": {"quality": 0.30, "reliability": 0.30, "speed": 0.20, "cost": 0.20},
    "cost_controlled": {"quality": 0.15, "reliability": 0.25, "speed": 0.15, "cost": 0.45},
    "fast_preview": {"quality": 0.15, "reliability": 0.20, "speed": 0.50, "cost": 0.15},
    "canon_critical": {"quality": 0.50, "reliability": 0.30, "speed": 0.05, "cost": 0.15},
}


def configured_routes() -> list[ProviderRoute]:
    """Return currently usable routes without revealing secret values."""
    return [
        ProviderRoute(
            provider="openai",
            model=os.getenv("GENESIS_OPENAI_IMAGE_MODEL", "configured-image-model"),
            capabilities=frozenset({"text", "text_to_image", "image_to_image"}),
            quality=0.90,
            reliability=0.92,
            speed=0.78,
            cost_factor=1.0,
            configured=bool(os.getenv("OPENAI_API_KEY")),
        ),
        ProviderRoute(
            provider="configured_video_provider",
            model=os.getenv("GENESIS_VIDEO_MODEL", "cinematic-video-model"),
            capabilities=frozenset({"text_to_video", "image_to_video", "video_extension"}),
            quality=0.88,
            reliability=0.84,
            speed=0.55,
            cost_factor=1.25,
            configured=bool(os.getenv("GENESIS_VIDEO_API_KEY") or os.getenv("RUNWAY_API_KEY")),
        ),
        ProviderRoute(
            provider="elevenlabs",
            model=os.getenv("GENESIS_VOICE_MODEL", "configured-voice-model"),
            capabilities=frozenset({"text_to_speech", "voice", "audio"}),
            quality=0.91,
            reliability=0.90,
            speed=0.86,
            cost_factor=1.10,
            configured=bool(os.getenv("ELEVENLABS_API_KEY")),
        ),
        ProviderRoute(
            provider="local_worker",
            model=os.getenv("GENESIS_LOCAL_MEDIA_MODEL", "local-media-worker"),
            capabilities=frozenset({"image_upscale", "background_removal", "transcription", "postproduction"}),
            quality=0.72,
            reliability=0.82,
            speed=0.72,
            cost_factor=0.25,
            configured=bool(os.getenv("GENESIS_LOCAL_WORKER_URL")),
        ),
        ProviderRoute(
            provider="manual_gateway",
            model="human-operated-provider-package",
            capabilities=frozenset({
                "text_to_image",
                "image_to_image",
                "text_to_video",
                "image_to_video",
                "text_to_speech",
                "music_generation",
                "sfx_generation",
                "three_d",
                "postproduction",
            }),
            quality=0.75,
            reliability=0.95,
            speed=0.20,
            cost_factor=1.0,
            configured=True,
            manual=True,
        ),
    ]


def operation_capability(domain: str, operation: str) -> str:
    if operation:
        return operation
    return domain


def select_route(domain: str, operation: str, profile: str) -> ProviderRoute:
    capability = operation_capability(domain, operation)
    compatible = [
        route
        for route in configured_routes()
        if route.configured and (capability in route.capabilities or domain in route.capabilities)
    ]
    if not compatible:
        compatible = [route for route in configured_routes() if route.manual]
    weights = PROFILE_WEIGHTS.get(profile, PROFILE_WEIGHTS["balanced"])

    def score(route: ProviderRoute) -> float:
        cost_score = max(0.0, 1.0 - min(route.cost_factor, 2.0) / 2.0)
        return (
            route.quality * weights["quality"]
            + route.reliability * weights["reliability"]
            + route.speed * weights["speed"]
            + cost_score * weights["cost"]
        )

    return max(compatible, key=score)


def estimate_cost(
    *,
    domain: str,
    operation: str,
    normalized_request: dict[str, Any],
    routing_profile: str,
    maximum_cost_usd: float | None,
) -> RenderEstimate:
    route = select_route(domain, operation, routing_profile)
    base = BASE_UNIT_COSTS.get(domain, 0.50)
    output_count = max(1, int(normalized_request.get("output_count", normalized_request.get("count", 1)) or 1))
    duration = max(1.0, float(normalized_request.get("duration_seconds", 1) or 1))
    resolution = str(normalized_request.get("resolution", "standard")).lower()
    resolution_factor = 1.0
    if "4k" in resolution or "2160" in resolution:
        resolution_factor = 2.25
    elif "1080" in resolution or "1920" in resolution:
        resolution_factor = 1.35

    quantity = duration if domain in {"video", "audio"} else 1.0
    estimated = round(base * quantity * output_count * resolution_factor * route.cost_factor, 2)
    if route.manual:
        # Manual mode packages the job but cannot know the provider's final charge.
        estimated = round(max(estimated, float(normalized_request.get("manual_estimate_usd", estimated) or estimated)), 2)
    minimum = round(estimated * 0.85, 2)
    maximum = round(max(estimated * 1.25, estimated + 0.01), 2)
    threshold = float(os.getenv("GENESIS_RENDER_APPROVAL_USD", "25"))
    approval_required = maximum > threshold or (maximum_cost_usd is not None and maximum > maximum_cost_usd)
    assumptions = [
        f"{output_count} output candidate(s)",
        f"route={route.provider}/{route.model}",
        f"profile={routing_profile}",
    ]
    if domain in {"video", "audio"}:
        assumptions.append(f"duration={duration:g}s")
    if route.manual:
        assumptions.append("manual provider execution; final charge requires reconciliation")
    return RenderEstimate(
        provider=route.provider,
        model=route.model,
        estimated_cost_usd=estimated,
        minimum_cost_usd=minimum,
        maximum_cost_usd=maximum,
        approval_required=approval_required,
        assumptions=assumptions,
    )


def public_provider_health() -> list[dict[str, Any]]:
    return [
        {
            "provider": route.provider,
            "model": route.model,
            "configured": route.configured,
            "manual": route.manual,
            "state": "healthy" if route.configured else "not_configured",
            "capabilities": sorted(route.capabilities),
        }
        for route in configured_routes()
    ]
