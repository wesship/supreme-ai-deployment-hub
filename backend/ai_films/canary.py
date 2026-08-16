from __future__ import annotations

import asyncio
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PAID_PROVIDER_ENV_VARS = (
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
    "VAPI_PRIVATE_KEY",
    "POLLO_API_KEY",
    "KLING_API_KEY",
    "TWELVELABS_API_KEY",
)


@dataclass(frozen=True)
class CanaryResult:
    source_path: str
    frame_count: int
    conform_path: str
    otio_path: str


def _provider_guard() -> dict[str, str | None]:
    """Snapshot and blank paid-provider credentials for the canary process.

    The canary is intentionally limited to local FFmpeg/OCIO/OpenEXR work plus
    the already-configured internal persistence/control-plane code. It must not
    be able to call paid model/media providers even if production secrets are
    present in the parent process.
    """
    previous: dict[str, str | None] = {}
    for key in PAID_PROVIDER_ENV_VARS:
        previous[key] = os.environ.get(key)
        os.environ.pop(key, None)
    os.environ["AI_FILMS_CANARY_MODE"] = "1"
    return previous


def _restore_provider_env(previous: dict[str, str | None]) -> None:
    os.environ.pop("AI_FILMS_CANARY_MODE", None)
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def make_synthetic_clip(output_path: Path, *, duration_seconds: float = 0.5) -> Path:
    """Create a tiny deterministic Rec.709 clip with FFmpeg and no network calls."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=64x64:rate=24",
        "-t",
        f"{duration_seconds:.3f}",
        "-pix_fmt",
        "yuv420p",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        "-color_range",
        "tv",
        "-c:v",
        "libx264",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, shell=False, timeout=30)
    return output_path


async def run_local_mastering_canary() -> CanaryResult:
    """Exercise the deterministic local mastering path without paid providers.

    This intentionally does not create production database rows. It validates
    the media-decode/color/mastering/editorial path locally and is suitable for
    CI and operator smoke tests. A separate production control-plane canary may
    wrap this fixture once a dedicated canary owner/project exists.
    """
    previous = _provider_guard()
    try:
        from backend.ai_films.frame_sequence import decode_media_to_openexr_sequence

        with tempfile.TemporaryDirectory(prefix="ai-films-canary-") as tmp:
            root = Path(tmp)
            source = make_synthetic_clip(root / "source.mp4")
            out_dir = root / "master"
            result: Any = await asyncio.to_thread(
                decode_media_to_openexr_sequence,
                source,
                out_dir,
                source_color_space="Utility - sRGB - Texture",
            )

            conform_path = out_dir / "editorial_conform.json"
            otio_path = out_dir / "editorial_conform.otio"
            if not conform_path.exists() or not otio_path.exists():
                raise RuntimeError("canary did not emit editorial conform artifacts")

            conform = json.loads(conform_path.read_text(encoding="utf-8"))
            frame_count = int(conform.get("frame_count") or 0)
            if frame_count <= 0:
                raise RuntimeError("canary produced no mastered frames")

            return CanaryResult(
                source_path=str(source),
                frame_count=frame_count,
                conform_path=str(conform_path),
                otio_path=str(otio_path),
            )
    finally:
        _restore_provider_env(previous)
