from __future__ import annotations

from dataclasses import asdict, dataclass
from fractions import Fraction
import json
from pathlib import Path
import shutil
import subprocess
from typing import Any, Mapping

from backend.ai_films.camera_color import CameraColorMatch, infer_camera_color_from_metadata


class MediaMetadataError(RuntimeError):
    """Base error for AI FILMS media metadata extraction."""


class MediaProbeUnavailableError(MediaMetadataError):
    """Raised when ffprobe is not installed in the runtime."""


class MediaProbeFailedError(MediaMetadataError):
    """Raised when ffprobe cannot inspect an asset."""


@dataclass(frozen=True)
class MediaMetadata:
    path: str
    format_name: str | None
    duration_seconds: float | None
    bit_rate: int | None
    width: int | None
    height: int | None
    codec_name: str | None
    codec_long_name: str | None
    pixel_format: str | None
    bit_depth: int | None
    frame_rate: float | None
    color_range: str | None
    color_space: str | None
    color_transfer: str | None
    color_primaries: str | None
    camera_make: str | None
    camera_model: str | None
    tags: dict[str, str]
    raw_probe: dict[str, Any]

    def camera_hints(self) -> dict[str, object]:
        hints: dict[str, object] = {
            "format": self.format_name,
            "codec": self.codec_name,
            "pixel_format": self.pixel_format,
            "color_range": self.color_range,
            "color_space": self.color_space,
            "color_transfer": self.color_transfer,
            "color_primaries": self.color_primaries,
            "camera_make": self.camera_make,
            "camera_model": self.camera_model,
        }
        hints.update(self.tags)
        return {key: value for key, value in hints.items() if value not in (None, "")}

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _as_int(value: object) -> int | None:
    try:
        if value in (None, "", "N/A"):
            return None
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _as_float(value: object) -> float | None:
    try:
        if value in (None, "", "N/A"):
            return None
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _frame_rate(value: object) -> float | None:
    if value in (None, "", "0/0", "N/A"):
        return None
    try:
        return float(Fraction(str(value)))
    except (ValueError, ZeroDivisionError):
        return None


def _flatten_tags(*tag_maps: Mapping[str, object] | None) -> dict[str, str]:
    result: dict[str, str] = {}
    for tags in tag_maps:
        if not tags:
            continue
        for key, value in tags.items():
            if value is None:
                continue
            result[str(key).lower()] = str(value)
    return result


def _pick_tag(tags: Mapping[str, str], *names: str) -> str | None:
    for name in names:
        value = tags.get(name.lower())
        if value:
            return value
    return None


def parse_ffprobe_payload(path: str | Path, payload: Mapping[str, Any]) -> MediaMetadata:
    streams = payload.get("streams") or []
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    format_info = payload.get("format") or {}
    tags = _flatten_tags(format_info.get("tags"), video.get("tags"))

    bit_depth = (
        _as_int(video.get("bits_per_raw_sample"))
        or _as_int(video.get("bits_per_coded_sample"))
        or _as_int(tags.get("bit_depth"))
    )

    return MediaMetadata(
        path=str(path),
        format_name=format_info.get("format_name"),
        duration_seconds=_as_float(format_info.get("duration")),
        bit_rate=_as_int(format_info.get("bit_rate")),
        width=_as_int(video.get("width")),
        height=_as_int(video.get("height")),
        codec_name=video.get("codec_name"),
        codec_long_name=video.get("codec_long_name"),
        pixel_format=video.get("pix_fmt"),
        bit_depth=bit_depth,
        frame_rate=_frame_rate(video.get("avg_frame_rate") or video.get("r_frame_rate")),
        color_range=video.get("color_range"),
        color_space=video.get("color_space"),
        color_transfer=video.get("color_transfer"),
        color_primaries=video.get("color_primaries"),
        camera_make=_pick_tag(tags, "make", "manufacturer", "com.apple.quicktime.make"),
        camera_model=_pick_tag(tags, "model", "camera_model", "com.apple.quicktime.model"),
        tags=tags,
        raw_probe=dict(payload),
    )


def probe_media_metadata(
    path: str | Path,
    *,
    ffprobe_binary: str = "ffprobe",
    timeout_seconds: float = 20.0,
) -> MediaMetadata:
    media_path = Path(path)
    if not media_path.is_file():
        raise MediaProbeFailedError(f"Media asset does not exist: {media_path}")

    ffprobe = shutil.which(ffprobe_binary)
    if ffprobe is None:
        raise MediaProbeUnavailableError(f"ffprobe executable not found: {ffprobe_binary}")

    command = [
        ffprobe,
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        "--",
        str(media_path),
    ]
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise MediaProbeFailedError(f"ffprobe timed out for {media_path.name}") from exc

    if result.returncode != 0:
        detail = result.stderr.strip()[-500:] or "unknown ffprobe error"
        raise MediaProbeFailedError(f"ffprobe failed for {media_path.name}: {detail}")

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise MediaProbeFailedError(f"ffprobe returned invalid JSON for {media_path.name}") from exc

    return parse_ffprobe_payload(media_path, payload)


def resolve_media_camera_color(metadata: MediaMetadata) -> CameraColorMatch:
    """Feed normalized probe metadata into the existing conservative camera resolver."""

    return infer_camera_color_from_metadata(
        metadata.camera_hints(),
        filename=Path(metadata.path).name,
    )
