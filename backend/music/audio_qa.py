"""Audio validation and mastering service for D3VONN Music Studio.

This endpoint is intended for private service-to-service use by the music Edge
Function. It validates an audio artifact with ffprobe, analyzes loudness and
silence with ffmpeg, produces a normalized mastered copy, and returns a concise
QA record. It deliberately does not hold provider credentials.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl

router = APIRouter(prefix="/music", tags=["music"])

MAX_AUDIO_BYTES = 32 * 1024 * 1024
MIN_DURATION_SECONDS = 1.0
MAX_DURATION_SECONDS = 610.0
MAX_SILENCE_RATIO = 0.60
MIN_PEAK_DB = -45.0


class AudioQaRequest(BaseModel):
    source_url: HttpUrl
    target_lufs: float = Field(default=-14.0, ge=-23.0, le=-8.0)
    true_peak_dbtp: float = Field(default=-1.0, ge=-6.0, le=0.0)


class AudioQaResponse(BaseModel):
    audio_base64: str
    content_type: str
    qa_result: dict[str, Any]


def _require_service_token(token: str | None) -> None:
    expected = os.getenv("MUSIC_AUDIO_QA_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Music audio QA token is not configured",
        )
    if not token or token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid music audio QA token")


async def _run_command(*command: str) -> tuple[str, str]:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    stdout_text = stdout.decode("utf-8", errors="replace")
    stderr_text = stderr.decode("utf-8", errors="replace")
    if process.returncode != 0:
        raise RuntimeError(f"Media command failed: {' '.join(command[:2])}: {stderr_text[-500:]}")
    return stdout_text, stderr_text


async def _download_audio(source_url: str, target_path: Path) -> tuple[int, str]:
    parsed = urlparse(source_url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio source must use HTTP or HTTPS")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0), follow_redirects=False) as client:
            async with client.stream("GET", source_url, headers={"Accept": "audio/*"}) as response:
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Audio source returned HTTP {response.status_code}",
                    )
                content_type = response.headers.get("content-type", "audio/mpeg").split(";", 1)[0].strip().lower()
                if not content_type.startswith("audio/") and content_type not in {"application/octet-stream", "video/ogg"}:
                    raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"Unexpected source type: {content_type}")
                size = 0
                with target_path.open("wb") as target:
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > MAX_AUDIO_BYTES:
                            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio source exceeds 32 MB")
                        target.write(chunk)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to download audio source") from exc
    if size == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Audio source is empty")
    return size, content_type


async def _probe(path: Path) -> dict[str, Any]:
    stdout, _ = await _run_command(
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration,format_name,bit_rate:stream=codec_name,codec_type,sample_rate,channels",
        "-of",
        "json",
        str(path),
    )
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="ffprobe returned invalid metadata") from exc
    audio_streams = [stream for stream in payload.get("streams", []) if stream.get("codec_type") == "audio"]
    if not audio_streams:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No audio stream found")
    try:
        duration = float(payload["format"]["duration"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Audio duration is unavailable") from exc
    if not MIN_DURATION_SECONDS <= duration <= MAX_DURATION_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Audio duration must be between {MIN_DURATION_SECONDS:g} and {MAX_DURATION_SECONDS:g} seconds",
        )
    audio_stream = audio_streams[0]
    return {
        "duration_seconds": round(duration, 3),
        "format": payload.get("format", {}).get("format_name"),
        "bit_rate": payload.get("format", {}).get("bit_rate"),
        "codec": audio_stream.get("codec_name"),
        "sample_rate": audio_stream.get("sample_rate"),
        "channels": audio_stream.get("channels"),
    }


async def _volume(path: Path) -> dict[str, float | None]:
    _, stderr = await _run_command("ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-")
    mean_match = re.search(r"mean_volume:\s*(-?[\d.]+) dB", stderr)
    max_match = re.search(r"max_volume:\s*(-?[\d.]+) dB", stderr)
    return {
        "mean_volume_db": float(mean_match.group(1)) if mean_match else None,
        "max_volume_db": float(max_match.group(1)) if max_match else None,
    }


async def _silence(path: Path, duration: float) -> dict[str, Any]:
    _, stderr = await _run_command(
        "ffmpeg",
        "-hide_banner",
        "-i",
        str(path),
        "-af",
        "silencedetect=n=-50dB:d=0.75",
        "-f",
        "null",
        "-",
    )
    durations = [float(match) for match in re.findall(r"silence_duration:\s*([\d.]+)", stderr)]
    total = round(sum(durations), 3)
    return {
        "segments": len(durations),
        "total_seconds": total,
        "ratio": round(total / duration, 4) if duration else 0.0,
    }


async def _master(source: Path, target: Path, target_lufs: float, true_peak_dbtp: float) -> None:
    # A deterministic one-pass loudness normalization is preferable here to a
    # provider-specific preset. The original is retained separately for auditability.
    filter_chain = f"loudnorm=I={target_lufs}:TP={true_peak_dbtp}:LRA=11"
    await _run_command(
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-i",
        str(source),
        "-map_metadata",
        "-1",
        "-af",
        filter_chain,
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        str(target),
    )


@router.post("/audio-qa", response_model=AudioQaResponse)
async def audio_qa_and_master(
    request: AudioQaRequest,
    x_music_qa_token: str | None = Header(default=None),
) -> AudioQaResponse:
    """Validate and master a privately signed generated-audio artifact."""
    _require_service_token(x_music_qa_token)
    with tempfile.TemporaryDirectory(prefix="d3vonn-music-") as temporary_directory:
        workdir = Path(temporary_directory)
        source_path = workdir / "source.bin"
        mastered_path = workdir / "mastered.mp3"
        source_size, source_content_type = await _download_audio(str(request.source_url), source_path)
        try:
            metadata = await _probe(source_path)
            volume_before = await _volume(source_path)
            silence = await _silence(source_path, metadata["duration_seconds"])
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Audio QA dependencies ffmpeg and ffprobe are not installed",
            ) from exc
        max_volume = volume_before["max_volume_db"]
        if max_volume is None or max_volume < MIN_PEAK_DB:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Generated audio did not contain a usable audible signal")
        if silence["ratio"] > MAX_SILENCE_RATIO:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Generated audio contains excessive silence")
        await _master(source_path, mastered_path, request.target_lufs, request.true_peak_dbtp)
        mastered_metadata = await _probe(mastered_path)
        volume_after = await _volume(mastered_path)
        mastered_bytes = mastered_path.read_bytes()
        if not mastered_bytes or len(mastered_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Mastered audio is empty or exceeds storage limits")
        qa_result: dict[str, Any] = {
            "status": "passed",
            "pipeline": ["validation", "metadata", "loudness_analysis", "silence_detection", "mastering"],
            "source": {"size_bytes": source_size, "content_type": source_content_type, "metadata": metadata, "volume": volume_before},
            "mastered": {"size_bytes": len(mastered_bytes), "content_type": "audio/mpeg", "metadata": mastered_metadata, "volume": volume_after},
            "silence": silence,
            "mastering": {"target_lufs": request.target_lufs, "true_peak_dbtp": request.true_peak_dbtp, "codec": "mp3", "bit_rate": "192k"},
        }
        return AudioQaResponse(
            audio_base64=base64.b64encode(mastered_bytes).decode("ascii"),
            content_type="audio/mpeg",
            qa_result=qa_result,
        )
