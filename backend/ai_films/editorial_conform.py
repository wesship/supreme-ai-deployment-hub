from __future__ import annotations

from dataclasses import asdict, dataclass
from fractions import Fraction
import json
from pathlib import Path
import re
from typing import Sequence


class EditorialConformError(RuntimeError):
    """Raised when AI FILMS cannot build deterministic editorial provenance."""


class EditorialDependencyError(EditorialConformError):
    """Raised when OpenTimelineIO is unavailable."""


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


def rate_fraction(frame_rate: float) -> Fraction:
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


def _drop_frame_params(frame_rate: float) -> tuple[int, int] | None:
    if abs(frame_rate - 29.97) < 0.01:
        return 30, 2
    if abs(frame_rate - 59.94) < 0.01:
        return 60, 4
    return None


def _parse_timecode(value: str, frame_rate: float) -> tuple[int, int, int, int, bool]:
    drop_frame = ";" in value
    parts = value.replace(";", ":").split(":")
    if len(parts) != 4:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}")
    try:
        hours, minutes, seconds, frames = (int(part) for part in parts)
    except ValueError as exc:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}") from exc
    nominal = max(1, round(frame_rate))
    if hours < 0 or not 0 <= minutes < 60 or not 0 <= seconds < 60 or not 0 <= frames < nominal:
        raise EditorialConformError(f"invalid SMPTE timecode: {value}")
    params = _drop_frame_params(frame_rate)
    if drop_frame and params is None:
        raise EditorialConformError("drop-frame timecode is only supported for 29.97 or 59.94 fps")
    if drop_frame and params is not None:
        _, dropped = params
        if minutes % 10 != 0 and seconds == 0 and frames < dropped:
            raise EditorialConformError(f"invalid dropped SMPTE label: {value}")
    return hours, minutes, seconds, frames, drop_frame


def _timecode_to_frame_count(value: str, frame_rate: float) -> tuple[int, bool]:
    hours, minutes, seconds, frames, drop_frame = _parse_timecode(value, frame_rate)
    nominal = max(1, round(frame_rate))
    count = (((hours * 60) + minutes) * 60 + seconds) * nominal + frames
    if drop_frame:
        _, dropped = _drop_frame_params(frame_rate) or (nominal, 0)
        total_minutes = hours * 60 + minutes
        count -= dropped * (total_minutes - total_minutes // 10)
    return count, drop_frame


def _frame_count_to_timecode(frame_count: int, frame_rate: float, drop_frame: bool) -> str:
    nominal = max(1, round(frame_rate))
    separator = ";" if drop_frame else ":"
    adjusted = frame_count
    if drop_frame:
        params = _drop_frame_params(frame_rate)
        if params is None:
            raise EditorialConformError("drop-frame timecode requires 29.97 or 59.94 fps")
        nominal, dropped = params
        frames_per_10_minutes = nominal * 60 * 10 - dropped * 9
        frames_per_minute = nominal * 60 - dropped
        adjusted %= (nominal * 60 * 60 * 24 - dropped * 54 * 24)
        ten_minute_blocks, remainder = divmod(adjusted, frames_per_10_minutes)
        adjusted += dropped * 9 * ten_minute_blocks
        if remainder >= dropped:
            adjusted += dropped * ((remainder - dropped) // frames_per_minute)
    else:
        adjusted %= nominal * 60 * 60 * 24

    frames = adjusted % nominal
    total_seconds = adjusted // nominal
    seconds = total_seconds % 60
    total_minutes = total_seconds // 60
    minutes = total_minutes % 60
    hours = (total_minutes // 60) % 24
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}{separator}{frames:02d}"


def timecode_for_index(start_timecode: str, frame_index: int, frame_rate: float) -> str:
    if frame_index < 0:
        raise EditorialConformError("frame index must be non-negative")
    start_count, drop_frame = _timecode_to_frame_count(start_timecode, frame_rate)
    return _frame_count_to_timecode(start_count + frame_index, frame_rate, drop_frame)


def build_editorial_conform_manifest(
    *,
    source_path: str | Path,
    exr_frames: Sequence[str | Path],
    frame_rate: float,
    start_timecode: str = "00:00:00:00",
    source_start_frame: int = 0,
    source_pts_seconds: Sequence[float] | None = None,
) -> EditorialConformManifest:
    if source_start_frame < 0:
        raise EditorialConformError("source_start_frame must be non-negative")
    if source_pts_seconds is not None and len(source_pts_seconds) != len(exr_frames):
        raise EditorialConformError("source PTS count must match EXR frame count")
    rate = rate_fraction(frame_rate)
    identities: list[FrameEditorialIdentity] = []
    for offset, frame in enumerate(exr_frames):
        source_index = source_start_frame + offset
        pts = (
            float(source_pts_seconds[offset])
            if source_pts_seconds is not None
            else float(Fraction(source_index * rate.denominator, rate.numerator))
        )
        identities.append(
            FrameEditorialIdentity(
                frame_number=offset + 1,
                exr_path=str(frame),
                source_frame_index=source_index,
                source_pts_seconds=pts,
                source_timecode=timecode_for_index(start_timecode, source_index, frame_rate),
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


def _load_otio():
    try:
        import opentimelineio as otio  # type: ignore
    except ImportError as exc:
        raise EditorialDependencyError("OpenTimelineIO runtime support is unavailable") from exc
    return otio


def to_otio_timeline(manifest: EditorialConformManifest):
    """Build a real OTIO timeline referencing the canonical EXR image sequence."""
    if not manifest.frames:
        raise EditorialConformError("cannot create an OTIO timeline for an empty conform")
    otio = _load_otio()
    rate = manifest.frame_rate_numerator / manifest.frame_rate_denominator
    first_path = Path(manifest.frames[0].exr_path)
    match = re.match(r"^(.*?)(\d+)(\.[^.]+)$", first_path.name)
    if not match:
        raise EditorialConformError(f"EXR frame name is not a numbered sequence: {first_path.name}")
    prefix, digits, suffix = match.groups()
    expected_dir = first_path.parent
    for identity in manifest.frames:
        candidate = Path(identity.exr_path)
        if candidate.parent != expected_dir:
            raise EditorialConformError("OTIO image sequence frames must share one directory")

    time_range = otio.opentime.TimeRange(
        start_time=otio.opentime.RationalTime(0, rate),
        duration=otio.opentime.RationalTime(len(manifest.frames), rate),
    )
    media_ref = otio.schema.ImageSequenceReference(
        target_url_base=expected_dir.resolve().as_uri() + "/",
        name_prefix=prefix,
        name_suffix=suffix,
        start_frame=int(digits),
        frame_step=1,
        rate=rate,
        frame_zero_padding=len(digits),
        available_range=time_range,
        metadata={
            "ai_films": {
                "source_path": manifest.source_path,
                "start_timecode": manifest.start_timecode,
                "frames": [asdict(frame) for frame in manifest.frames],
            }
        },
    )
    clip = otio.schema.Clip(name=Path(manifest.source_path).stem)
    clip.media_reference = media_ref
    clip.source_range = time_range
    track = otio.schema.Track(name="AI FILMS EXR Masters", kind=otio.schema.TrackKind.Video)
    track.append(clip)
    timeline = otio.schema.Timeline(name=Path(manifest.source_path).stem)
    timeline.global_start_time = otio.opentime.RationalTime(0, rate)
    timeline.metadata["ai_films"] = {
        "source_path": manifest.source_path,
        "start_timecode": manifest.start_timecode,
        "frame_rate": f"{manifest.frame_rate_numerator}/{manifest.frame_rate_denominator}",
        "frame_count": len(manifest.frames),
    }
    timeline.tracks.append(track)
    return timeline


def to_otio_dict(manifest: EditorialConformManifest) -> dict:
    otio = _load_otio()
    return json.loads(otio.adapters.write_to_string(to_otio_timeline(manifest), adapter_name="otio_json"))


def write_otio_timeline(manifest: EditorialConformManifest, path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    otio = _load_otio()
    otio.adapters.write_to_file(to_otio_timeline(manifest), str(target), adapter_name="otio_json")
    return target
