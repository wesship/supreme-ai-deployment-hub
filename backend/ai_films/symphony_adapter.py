"""Authorized boundary for the TikTok Symphony API.

This module intentionally does not implement undocumented endpoints or browser
automation. It validates jobs and produces a provider-neutral request model;
an API transport may be attached once D3VONN has authorized Symphony API access.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

GenerationMode = Literal["text_to_video", "image_to_video", "reference_to_video"]


@dataclass(frozen=True)
class SymphonyRequest:
    mode: GenerationMode
    prompt: str
    asset_urls: tuple[str, ...] = ()
    aspect_ratio: Literal["9:16", "16:9", "1:1"] = "16:9"
    duration_seconds: int = 10


class SymphonyConfigurationError(ValueError):
    pass


class SymphonyNotEnabledError(RuntimeError):
    pass


def validate_symphony_request(request: SymphonyRequest) -> None:
    if not request.prompt.strip():
        raise SymphonyConfigurationError("prompt must not be empty")
    if request.duration_seconds < 1 or request.duration_seconds > 30:
        raise SymphonyConfigurationError("duration must be between 1 and 30 seconds")
    if request.mode == "image_to_video" and not request.asset_urls:
        raise SymphonyConfigurationError("image_to_video requires at least one asset")
    if request.mode == "reference_to_video" and not request.asset_urls:
        raise SymphonyConfigurationError("reference_to_video requires at least one asset")


def build_symphony_request(**kwargs: object) -> SymphonyRequest:
    request = SymphonyRequest(**kwargs)  # type: ignore[arg-type]
    validate_symphony_request(request)
    return request


def production_transport_enabled() -> bool:
    """Hard gate: false until an authorized API transport is installed."""
    return False


def submit_to_symphony(request: SymphonyRequest) -> None:
    """Fail closed until official credentials/transport are configured."""
    validate_symphony_request(request)
    if not production_transport_enabled():
        raise SymphonyNotEnabledError(
            "Symphony API transport is not enabled; no production request was sent"
        )
    raise NotImplementedError("Attach the authorized Symphony API transport here")
