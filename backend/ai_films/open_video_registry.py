"""Registry metadata for self-hosted/open AI film video engines.

This module intentionally stores model metadata and capability routing only;
it does not download weights or silently accept model licenses. Production
code should validate the selected checkpoint/license before commercial use.
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


OPEN_VIDEO_MODELS: tuple[VideoModelSpec, ...] = (
    VideoModelSpec(
        key="wan2.2-ti2v-5b",
        family="wan2.2",
        capabilities=("t2v", "i2v", "ti2v", "720p", "24fps"),
        runtime="native-or-comfyui",
        source="https://github.com/Wan-Video/Wan2.2",
        license_note="Verify the exact checkpoint license before commercial redistribution/use.",
    ),
    VideoModelSpec(
        key="ltx-2.x",
        family="ltx",
        capabilities=("t2v", "i2v", "audio-video", "multishot", "lora"),
        runtime="native-or-comfyui",
        source="https://github.com/Lightricks/LTX-2",
        license_note="Model/checkpoint terms are distinct from ordinary permissive source-code licensing; verify the applicable Community License terms.",
    ),
)


def get_video_model(key: str) -> VideoModelSpec:
    for spec in OPEN_VIDEO_MODELS:
        if spec.key == key:
            return spec
    raise ValueError(f"Unsupported open video model: {key}")


def route_video(*, audio: bool = False, image_input: bool = False, animation: bool = False) -> str:
    """Choose a default adapter without coupling the film graph to a vendor."""
    if audio:
        return "ltx-2.x"
    if animation:
        return "wan2.2-ti2v-5b"
    if image_input:
        return "wan2.2-ti2v-5b"
    return "ltx-2.x"
