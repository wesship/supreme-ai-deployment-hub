from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess

from backend.ai_films.color_management import write_color_managed_exr
from backend.ai_films.editorial_conform import (
    build_editorial_conform_manifest,
    timecode_for_index,
    write_editorial_manifest,
    write_otio_timeline,
)
from backend.ai_films.media_metadata import MediaMetadata, probe_media_metadata, resolve_media_camera_color


class FrameSequenceError(RuntimeError):
    """Base error for AI FILMS frame sequence generation."""


class FrameDecoderUnavailableError(FrameSequenceError):
    """Raised when FFmpeg/ffprobe is unavailable."""


class FrameDecodeError(FrameSequenceError):
    """Raised when FFmpeg cannot decode the source asset."""


@dataclass(frozen=True)
class FrameSequenceManifest:
    source_path: str
    output_directory: str
    width: int
    height: int
    frame_rate: float | None
    frame_count: int
    source_color_space: str
    frames: tuple[str, ...]
    editorial_manifest_path: str | None = None
    otio_timeline_path: str | None = None


def _require_numpy():
    try:
        import numpy as np
    except ImportError as exc:
        raise FrameSequenceError("NumPy is required for AI FILMS frame decoding") from exc
    return np


def probe_frame_timestamps(
    source: str | Path,
    *,
    ffprobe_binary: str = "ffprobe",
    timeout_seconds: float = 300.0,
) -> tuple[float, ...]:
    """Return real decoded-frame timestamps, preserving VFR edit points."""
    ffprobe = shutil.which(ffprobe_binary)
    if ffprobe is None:
        raise FrameDecoderUnavailableError(f"ffprobe executable not found: {ffprobe_binary}")
    command = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "frame=best_effort_timestamp_time",
        "-of",
        "csv=p=0",
        str(source),
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise FrameDecodeError(f"Unable to probe frame timestamps for {Path(source).name}") from exc
    if result.returncode != 0:
        raise FrameDecodeError(
            f"ffprobe frame timestamp scan failed for {Path(source).name}: "
            f"{result.stderr.strip()[-500:] or 'unknown error'}"
        )
    timestamps: list[float] = []
    for line in result.stdout.splitlines():
        value = line.strip().split(",", 1)[0]
        if not value or value == "N/A":
            continue
        try:
            timestamps.append(float(value))
        except ValueError as exc:
            raise FrameDecodeError(f"Invalid ffprobe frame timestamp: {value}") from exc
    if not timestamps:
        raise FrameDecodeError(f"ffprobe returned no video frame timestamps for {Path(source).name}")
    return tuple(timestamps)


def decode_to_acescg_exr_sequence(
    source: str | Path,
    output_directory: str | Path,
    *,
    metadata: MediaMetadata | None = None,
    ffmpeg_binary: str = "ffmpeg",
    ffprobe_binary: str = "ffprobe",
    timeout_seconds: float = 1800.0,
    start_number: int = 1,
    start_timecode: str | None = None,
) -> FrameSequenceManifest:
    """Decode media into ACEScg EXRs with frame/PTS/timecode editorial provenance."""
    source_path = Path(source)
    if not source_path.is_file():
        raise FrameDecodeError(f"Media asset does not exist: {source_path}")
    if start_number < 0:
        raise FrameSequenceError("start_number must be non-negative")

    ffmpeg = shutil.which(ffmpeg_binary)
    if ffmpeg is None:
        raise FrameDecoderUnavailableError(f"ffmpeg executable not found: {ffmpeg_binary}")

    media = metadata or probe_media_metadata(source_path)
    if not media.width or not media.height or not media.frame_rate:
        raise FrameDecodeError("Media probe did not return valid resolution/frame rate")
    camera_match = resolve_media_camera_color(media)
    timestamps = probe_frame_timestamps(
        source_path,
        ffprobe_binary=ffprobe_binary,
        timeout_seconds=min(timeout_seconds, 300.0),
    )
    source_timecode = start_timecode or media.tags.get("timecode") or "00:00:00:00"

    output_dir = Path(output_directory)
    output_dir.mkdir(parents=True, exist_ok=True)
    width, height = media.width, media.height
    bytes_per_frame = width * height * 3 * 4
    np = _require_numpy()

    command = [
        ffmpeg,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source_path),
        "-map",
        "0:v:0",
        "-vsync",
        "0",
        "-an",
        "-sn",
        "-dn",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gbrpf32le",
        "pipe:1",
    ]

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
        )
    except OSError as exc:
        raise FrameDecodeError(f"Unable to start ffmpeg for {source_path.name}") from exc

    frames: list[str] = []
    used_timestamps: list[float] = []
    try:
        assert process.stdout is not None
        frame_number = start_number
        offset = 0
        while True:
            payload = process.stdout.read(bytes_per_frame)
            if not payload:
                break
            if len(payload) != bytes_per_frame:
                raise FrameDecodeError(
                    f"ffmpeg returned a partial frame for {source_path.name}: "
                    f"{len(payload)} of {bytes_per_frame} bytes"
                )
            if offset >= len(timestamps):
                raise FrameDecodeError("decoded frame count exceeds ffprobe timestamp count")

            plane_size = width * height
            pixels = np.frombuffer(payload, dtype="<f4", count=plane_size * 3)
            green = pixels[0:plane_size]
            blue = pixels[plane_size : plane_size * 2]
            red = pixels[plane_size * 2 : plane_size * 3]
            pts = timestamps[offset]
            timecode = timecode_for_index(source_timecode, offset, media.frame_rate)

            frame_path = output_dir / f"frame_{frame_number:08d}.exr"
            write_color_managed_exr(
                frame_path,
                width=width,
                height=height,
                red=red,
                green=green,
                blue=blue,
                source_space=camera_match.source_space,
                metadata={
                    "aiFilmsSourceFrameIndex": offset,
                    "aiFilmsSourcePTSSeconds": pts,
                    "aiFilmsSourceTimecode": timecode,
                    "aiFilmsSourceAsset": source_path.name,
                },
            )
            frames.append(str(frame_path))
            used_timestamps.append(pts)
            frame_number += 1
            offset += 1

        try:
            return_code = process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired as exc:
            process.kill()
            process.wait()
            raise FrameDecodeError(f"ffmpeg timed out for {source_path.name}") from exc

        if return_code != 0:
            stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
            raise FrameDecodeError(
                f"ffmpeg failed for {source_path.name}: {stderr.strip()[-500:] or 'unknown error'}"
            )
    except Exception:
        if process.poll() is None:
            process.kill()
            process.wait()
        raise
    finally:
        if process.stdout:
            process.stdout.close()
        if process.stderr:
            process.stderr.close()

    if not frames:
        raise FrameDecodeError(f"ffmpeg decoded no video frames from {source_path.name}")

    conform = build_editorial_conform_manifest(
        source_path=source_path,
        exr_frames=frames,
        frame_rate=media.frame_rate,
        start_timecode=source_timecode,
        source_pts_seconds=used_timestamps,
    )
    conform_path = write_editorial_manifest(conform, output_dir / "editorial_conform.json")
    otio_path = write_otio_timeline(conform, output_dir / "editorial_conform.otio")

    return FrameSequenceManifest(
        source_path=str(source_path),
        output_directory=str(output_dir),
        width=width,
        height=height,
        frame_rate=media.frame_rate,
        frame_count=len(frames),
        source_color_space=camera_match.source_space,
        frames=tuple(frames),
        editorial_manifest_path=str(conform_path),
        otio_timeline_path=str(otio_path),
    )
