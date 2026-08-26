"""D3VONN AI Films contract for an authorized TikTok Symphony adapter.

This module defines the boundary only. It does not call TikTok and does not
make an unverified credential or access path executable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


JobMode = Literal["text_to_video", "image_to_video", "reference_to_video"]


@dataclass(frozen=True)
class SymphonyGenerationRequest:
    mode: JobMode
    prompt: str
    asset_refs: tuple[str, ...] = ()
    duration_seconds: int = 10
    aspect_ratio: str = "9:16"


@dataclass(frozen=True)
class SymphonyProviderPolicy:
    provider: str = "symphony_tiktok"
    status: str = "verification_candidate"
    production_enabled: bool = False
    requires_authorized_api_access: bool = True
    preserve_ai_labeling: bool = True
    max_duration_seconds: int = 30


POLICY = SymphonyProviderPolicy()


def validate_request(request: SymphonyGenerationRequest) -> None:
    if not request.prompt.strip():
        raise ValueError("Symphony request requires a non-empty prompt")
    if request.duration_seconds < 1 or request.duration_seconds > POLICY.max_duration_seconds:
        raise ValueError("duration_seconds is outside the D3VONN Symphony policy")
    if request.mode != "text_to_video" and not request.asset_refs:
        raise ValueError("image/reference modes require asset_refs")
    if request.aspect_ratio not in {"9:16", "16:9", "1:1"}:
        raise ValueError("unsupported aspect_ratio")


def production_eligibility() -> bool:
    """Hard gate: remains false until API access and benchmark approval exist."""
    return POLICY.production_enabled
