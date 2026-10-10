"""Registry metadata for self-hosted/open AI film video engines.

This module stores model metadata and deterministic routing only. It does not
activate a provider, download weights, or accept model/checkpoint licenses.
Production execution remains gated by the local GPU worker acceptance path.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class VideoModelSpec:
    key: str
    family: str
    capabilities: tuple[str, ...]
    runtime: str
    source: str
    license_note: str
    execution_enabled: bool = False


OPEN_VIDEO_MODELS: tuple[VideoModelSpec, ...] = (
    VideoModelSpec(
        key="wan2.2-ti2v-5b",
        family="wan2.2",
        capabilities=("t2v", "i2v", "ti2v", "720p", "24fps"),
        runtime="native-or-comfyui",
        source="https://github.com/Wan-Video/Wan2.2",
        license_note="Verify the exact source revision, checkpoint license, model revision, and SHA-256 before commercial or production use.",
    ),
    VideoModelSpec(
        key="ltx-2.x",
        family="ltx",
        capabilities=("t2v", "i2v", "audio-video", "multishot", "lora"),
        runtime="native-or-comfyui",
        source="https://github.com/Lightricks/LTX-2",
        license_note="Verify the exact source revision, checkpoint/model terms, model revision, and SHA-256 before commercial or production use.",
    ),
)


def get_video_model(key: str) -> VideoModelSpec:
    for spec in OPEN_VIDEO_MODELS:
        if spec.key == key:
            return spec
    raise ValueError(f"Unsupported open video model: {key}")


def route_video(*, audio: bool = False, image_input: bool = False, animation: bool = False) -> str:
    """Choose a default model family without authorizing runtime execution."""
    if audio:
        return "ltx-2.x"
    if animation:
        return "wan2.2-ti2v-5b"
    if image_input:
        return "wan2.2-ti2v-5b"
    return "ltx-2.x"
