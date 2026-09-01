"""Evidence-backed candidate video-provider catalog for AI Films.

This module is metadata only. No catalog entry is executable by itself.
Production rendering still requires a shipped server-side adapter plus explicit
membership in AI_FILM_EXECUTABLE_VIDEO_PROVIDERS.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ProviderStatus = Literal[
    "unverified",
    "manual_bridge",
    "api_documented",
    "private_beta_api",
]
AutomationAccess = Literal[
    "unverified",
    "manual_only",
    "official_api",
    "private_beta_api",
]
CostModel = Literal[
    "unknown",
    "free_product",
    "paid_per_call",
    "paid_subscription",
]


@dataclass(frozen=True)
class FreeVideoProvider:
    provider: str
    display_name: str
    status: ProviderStatus
    automation_access: AutomationAccess
    cost_model: CostModel
    free_tier_verified: bool
    verified_on: str
    source_url: str
    source_label: str
    text_to_video: bool
    image_to_video: bool
    start_frame: bool
    end_frame: bool
    aspect_ratio: bool
    resolution: bool
    audio: bool
    lip_sync: bool
    notes: str


FREE_VIDEO_PROVIDERS: tuple[FreeVideoProvider, ...] = (
    FreeVideoProvider(
        provider="vibes_meta",
        display_name="Vibes AI (Meta)",
        status="manual_bridge",
        automation_access="manual_only",
        cost_model="unknown",
        free_tier_verified=False,
        verified_on="2026-09-01",
        source_url="https://about.fb.com/news/2025/09/introducing-vibes-ai-videos/",
        source_label="Meta product announcement",
        text_to_video=True,
        image_to_video=False,
        start_frame=False,
        end_frame=False,
        aspect_ratio=False,
        resolution=False,
        audio=True,
        lip_sync=False,
        notes=(
            "Meta documents Vibes as an interactive AI-video creation/remix product. "
            "No public automation API was verified for D3VONN, so this remains manual-only."
        ),
    ),
    FreeVideoProvider(
        provider="symphony_tiktok",
        display_name="Symphony Creative Studio (TikTok)",
        status="api_documented",
        automation_access="official_api",
        cost_model="free_product",
        free_tier_verified=True,
        verified_on="2026-09-01",
        source_url="https://ads.tiktok.com/creative/creativeCenter/tools/api",
        source_label="TikTok Symphony API",
        text_to_video=True,
        image_to_video=True,
        start_frame=False,
        end_frame=False,
        aspect_ratio=False,
        resolution=False,
        audio=False,
        lip_sync=True,
        notes=(
            "TikTok documents Symphony API video generation and dubbing/lip-sync. "
            "Creative Studio is described as a free creation tool, but D3VONN has not "
            "completed API access, credentials, quotas, or worker certification."
        ),
    ),
    FreeVideoProvider(
        provider="snapgen",
        display_name="SnapGen AI",
        status="api_documented",
        automation_access="official_api",
        cost_model="paid_per_call",
        free_tier_verified=False,
        verified_on="2026-09-01",
        source_url="https://snapgen.org/models/gemini-omni",
        source_label="SnapGen model/API documentation",
        text_to_video=True,
        image_to_video=True,
        start_frame=False,
        end_frame=False,
        aspect_ratio=False,
        resolution=True,
        audio=True,
        lip_sync=False,
        notes=(
            "SnapGen documents video API endpoints and per-call pricing. It is therefore "
            "not treated as a verified free API and remains non-executable until an adapter, "
            "credential path, terms review, and canary are complete."
        ),
    ),
    FreeVideoProvider(
        provider="zsky",
        display_name="ZSky AI",
        status="private_beta_api",
        automation_access="private_beta_api",
        cost_model="paid_subscription",
        free_tier_verified=True,
        verified_on="2026-09-01",
        source_url="https://zsky.ai/developers",
        source_label="ZSky developer access documentation",
        text_to_video=True,
        image_to_video=True,
        start_frame=True,
        end_frame=True,
        aspect_ratio=False,
        resolution=True,
        audio=True,
        lip_sync=True,
        notes=(
            "ZSky documents an unlimited free web product, while developer API access is "
            "a reviewed private-beta program on the paid Max plan. No D3VONN worker is enabled."
        ),
    ),
)


def free_video_provider_health() -> list[dict[str, object]]:
    """Return credential-free, evidence-backed catalog metadata for UI/ops views."""
    return [
        {
            "provider": provider.provider,
            "display_name": provider.display_name,
            "status": provider.status,
            "automation_access": provider.automation_access,
            "cost_model": provider.cost_model,
            "free_tier_verified": provider.free_tier_verified,
            "verified_on": provider.verified_on,
            "source_url": provider.source_url,
            "source_label": provider.source_label,
            "capabilities": {
                "text_to_video": provider.text_to_video,
                "image_to_video": provider.image_to_video,
                "start_frame": provider.start_frame,
                "end_frame": provider.end_frame,
                "aspect_ratio": provider.aspect_ratio,
                "resolution": provider.resolution,
                "audio": provider.audio,
                "lip_sync": provider.lip_sync,
            },
            "notes": provider.notes,
            # Deliberately independent of provider.status. Catalog evidence never
            # grants execution authority; only the server-side worker allowlist does.
            "production_eligible": False,
        }
        for provider in FREE_VIDEO_PROVIDERS
    ]
