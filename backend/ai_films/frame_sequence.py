from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess

from backend.ai_films.color_management import write_color_managed_exr
from backend.ai_films.media_metadata import MediaMetadata, probe_media_metadata, resolve_media_camera_color


class FrameSequenceError(RuntimeError):
    """Base error for AI FILMS frame sequence generation."""


class FrameDecoderUnavailableError(FrameSequenceError):
    """Raised when FFmpeg is unavailable."""


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


def _require_numpy():
    try:
        import numpy as np
    except ImportError as exc:
        raise FrameSequenceError("NumPy is required for AI FILMS frame decoding") from exc
    return np


def decode_to_acescg_exr_sequence(
    source: str | Path,
    output_directory: str | Path,
    *,
    metadata: MediaMetadata | None = None,
    ffmpeg_binary: str = "ffmpeg",
    timeout_seconds: float = 1800.0,
    start_number: int = 1,
) -> FrameSequenceManifest:
    """Decode video deterministically and emit canonical ACEScg OpenEXR frames.

    FFmpeg emits packed RGB float32 frames to stdout. Camera/container metadata is
    resolved through the conservative AI FILMS camera resolver; each decoded frame
    is then transformed through OCIO into ACEScg and written with the canonical
    OpenEXR writer. Audio is intentionally excluded from this image-sequence stage.
    """

    source_path = Path(source)
    if not source_path.is_file():
        raise FrameDecodeError(f"Media asset does not exist: {source_path}")
    if start_number < 0:
        raise FrameSequenceError("start_number must be non-negative")

    ffmpeg = shutil.which(ffmpeg_binary)
    if ffmpeg is None:
        raise FrameDecoderUnavailableError(f"ffmpeg executable not found: {ffmpeg_binary}")

    media = metadata or probe_media_metadata(source_path)
    if not media.width or not media.height:
        raise FrameDecodeError("Media probe did not return a valid video resolution")
    camera_match = resolve_media_camera_color(media)

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
    try:
        assert process.stdout is not None
        frame_number = start_number
        while True:
            payload = process.stdout.read(bytes_per_frame)
            if not payload:
                break
            if len(payload) != bytes_per_frame:
                raise FrameDecodeError(
                    f"ffmpeg returned a partial frame for {source_path.name}: "
                    f"{len(payload)} of {bytes_per_frame} bytes"
                )

            # gbrpf32le is planar G, B, R float32.
            plane_size = width * height
            pixels = np.frombuffer(payload, dtype="<f4", count=plane_size * 3)
            green = pixels[0:plane_size]
            blue = pixels[plane_size : plane_size * 2]
            red = pixels[plane_size * 2 : plane_size * 3]

            frame_path = output_dir / f"frame_{frame_number:08d}.exr"
            write_color_managed_exr(
                frame_path,
                width=width,
                height=height,
                red=red,
                green=green,
                blue=blue,
                source_space=camera_match.color_space,
            )
            frames.append(str(frame_path))
            frame_number += 1

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

    return FrameSequenceManifest(
        source_path=str(source_path),
        output_directory=str(output_dir),
        width=width,
        height=height,
        frame_rate=media.frame_rate,
        frame_count=len(frames),
        source_color_space=camera_match.color_space,
        frames=tuple(frames),
    )
