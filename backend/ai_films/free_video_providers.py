"""Optional/free video-provider contracts for AI Films.

These adapters deliberately contain capability metadata only. A provider is
not executable until a server-side worker/API integration is verified and
added to AI_FILM_EXECUTABLE_VIDEO_PROVIDERS.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ProviderStatus = Literal["unverified", "manual_bridge", "api_ready"]


@dataclass(frozen=True)
class FreeVideoProvider:
    provider: str
    display_name: str
    status: ProviderStatus
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
        "vibes_meta", "Vibes AI (Meta)", "unverified", True, True, True, True,
        True, True, True, True,
        "Reported beta/free workflow; verify API, automation, watermark, and commercial-use terms before activation.",
    ),
    FreeVideoProvider(
        "symphony_tiktok", "Symphony Creative Studio (TikTok)", "manual_bridge", True, True, True, True,
        True, True, False, False,
        "Reported weekly credits; treat web UI usage as manual until an official automation/API path is verified.",
    ),
    FreeVideoProvider(
        "snapgen", "SnapGen AI", "unverified", True, True, True, False,
        True, True, False, False,
        "Reported free-credit workflow; verify balance behavior, API access, ToS, and commercial rights.",
    ),
    FreeVideoProvider(
        "zsky", "Z Sky AI", "unverified", True, True, True, True,
        True, True, True, True,
        "Reported no-credit workflow; verify API/automation, watermark, ToS, and commercial rights.",
    ),
)


def free_video_provider_health() -> list[dict[str, object]]:
    """Return safe UI metadata without exposing credentials or enabling jobs."""
    return [
        {
            "provider": p.provider,
            "display_name": p.display_name,
            "status": p.status,
            "capabilities": {
                "text_to_video": p.text_to_video,
                "image_to_video": p.image_to_video,
                "start_frame": p.start_frame,
                "end_frame": p.end_frame,
                "aspect_ratio": p.aspect_ratio,
                "resolution": p.resolution,
                "audio": p.audio,
                "lip_sync": p.lip_sync,
            },
            "notes": p.notes,
            "production_eligible": p.status == "api_ready",
        }
        for p in FREE_VIDEO_PROVIDERS
    ]
