from __future__ import annotations

from dataclasses import asdict, dataclass
from fractions import Fraction
import json
from pathlib import Path
from typing import Sequence


class EditorialConformError(RuntimeError):
    """Raised when AI FILMS cannot build deterministic editorial provenance."""


@dataclass(frozen=True)
class FrameEditorialIdentity:
    frame_number: int
    exr_path: str
    source_frame_index: int
    source_pts_seconds: float
    source_timecode: str


@dataclass(frozen=True)
class EditorialConformManifest:
    source_path: str
    frame_rate_numerator: int
    frame_rate_denominator: int
    start_timecode: str
    frames: tuple[FrameEditorialIdentity, ...]


def _rate_fraction(frame_rate: float) -> Fraction:
    if frame_rate <= 0:
        raise EditorialConformError("frame rate must be positive")
    common = {
        23.976: Fraction(24000, 1001),
        29.97: Fraction(30000, 1001),
        59.94: Fraction(60000, 1001),
    }
    for value, fraction in common.items():
        if abs(frame_rate - value) < 0.002:
            return fraction
    return Fraction(frame_rate).limit_denominator(100000)


def _parse_timecode(value: str) -> tuple[int, int, int, int]:
    normalized = value.replace(";", ":")
    parts = normalized.split(":")
    if len(parts) != 4:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}")
    try:
        hours, minutes, seconds, frames = (int(part) for part in parts)
    except ValueError as exc:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}") from exc
    if hours < 0 or not 0 <= minutes < 60 or not 0 <= seconds < 60 or frames < 0:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}")
    return hours, minutes, seconds, frames


def _timecode_for_index(start_timecode: str, frame_index: int, frame_rate: float) -> str:
    if frame_index < 0:
        raise EditorialConformError("frame index must be non-negative")
    hours, minutes, seconds, frames = _parse_timecode(start_timecode)
    nominal = max(1, round(frame_rate))
    if frames >= nominal:
        raise EditorialConformError("start timecode frame field exceeds nominal frame rate")
    total = (((hours * 60) + minutes) * 60 + seconds) * nominal + frames + frame_index
    out_frames = total % nominal
    total //= nominal
    out_seconds = total % 60
    total //= 60
    out_minutes = total % 60
    out_hours = (total // 60) % 24
    return f"{out_hours:02d}:{out_minutes:02d}:{out_seconds:02d}:{out_frames:02d}"


def build_editorial_conform_manifest(
    *,
    source_path: str | Path,
    exr_frames: Sequence[str | Path],
    frame_rate: float,
    start_timecode: str = "00:00:00:00",
    source_start_frame: int = 0,
) -> EditorialConformManifest:
    if source_start_frame < 0:
        raise EditorialConformError("source_start_frame must be non-negative")
    rate = _rate_fraction(frame_rate)
    identities: list[FrameEditorialIdentity] = []
    for offset, frame in enumerate(exr_frames):
        source_index = source_start_frame + offset
        identities.append(
            FrameEditorialIdentity(
                frame_number=offset + 1,
                exr_path=str(frame),
                source_frame_index=source_index,
                source_pts_seconds=float(Fraction(source_index * rate.denominator, rate.numerator)),
                source_timecode=_timecode_for_index(start_timecode, source_index, frame_rate),
            )
        )
    return EditorialConformManifest(
        source_path=str(source_path),
        frame_rate_numerator=rate.numerator,
        frame_rate_denominator=rate.denominator,
        start_timecode=start_timecode,
        frames=tuple(identities),
    )


def write_editorial_manifest(manifest: EditorialConformManifest, path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(asdict(manifest), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return target


def to_otio_dict(manifest: EditorialConformManifest) -> dict:
    """Return an OpenTimelineIO-compatible JSON structure without requiring OTIO at runtime."""
    rate = manifest.frame_rate_numerator / manifest.frame_rate_denominator
    return {
        "OTIO_SCHEMA": "Timeline.1",
        "name": Path(manifest.source_path).stem,
        "global_start_time": {"OTIO_SCHEMA": "RationalTime.1", "value": 0.0, "rate": rate},
        "metadata": {
            "ai_films": {
                "source_path": manifest.source_path,
                "start_timecode": manifest.start_timecode,
                "frame_rate": f"{manifest.frame_rate_numerator}/{manifest.frame_rate_denominator}",
                "frame_count": len(manifest.frames),
            }
        },
        "tracks": {
            "OTIO_SCHEMA": "Stack.1",
            "name": "tracks",
            "children": [],
        },
    }
