"""Audio-overlay and subtitle finalization for AI Films assemblies."""
from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import Any, Awaitable, Callable, Mapping


class AssemblyTrackError(RuntimeError):
    pass


def _srt_time(seconds: float) -> str:
    millis = max(0, round(seconds * 1000))
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def write_srt(cues: list[Mapping[str, Any]], path: Path) -> None:
    lines: list[str] = []
    for idx, cue in enumerate(cues, start=1):
        start = float(cue.get("start") or 0)
        end = float(cue.get("end") or 0)
        text = str(cue.get("text") or "").strip()
        if not text or end <= start:
            continue
        lines.extend([str(idx), f"{_srt_time(start)} --> {_srt_time(end)}", text, ""])
    path.write_text("\n".join(lines), encoding="utf-8")


async def prepare_audio_tracks(
    db: Any,
    specs: list[Mapping[str, Any]],
    root: Path,
    *,
    resolve_asset: Callable[[Mapping[str, Any]], Any],
    download: Callable[[str, Path], Awaitable[None]],
) -> list[tuple[Path, dict[str, Any]]]:
    prepared: list[tuple[Path, dict[str, Any]]] = []
    for idx, spec in enumerate(specs):
        asset_id = str(spec.get("asset_id") or "")
        if not asset_id:
            raise AssemblyTrackError("Audio track is missing asset_id")
        row = await db.get_asset(asset_id)
        if not row:
            raise AssemblyTrackError(f"Audio asset {asset_id} is not registered")
        source = resolve_asset(row)
        suffix = Path(source.source_filename).suffix or ".audio"
        target = root / f"overlay-{idx:03d}{suffix}"
        await download(source.media_url, target)
        prepared.append((target, dict(spec)))
    return prepared


async def finalize_master(
    picture_master: Path,
    output_master: Path,
    *,
    audio_tracks: list[tuple[Path, dict[str, Any]]],
    subtitle_cues: list[Mapping[str, Any]],
) -> dict[str, Any]:
    """Mix registered dialogue/music/SFX and mux validated subtitles into MP4."""
    if not audio_tracks and not subtitle_cues:
        shutil.move(str(picture_master), str(output_master))
        return {"audio_overlay_count": 0, "subtitle_cue_count": 0, "subtitle_mode": "none"}

    if not shutil.which("ffmpeg"):
        raise AssemblyTrackError("FFmpeg is required to finalize audio/subtitle tracks")

    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(picture_master)]
    for path, _ in audio_tracks:
        command += ["-i", str(path)]

    subtitle_path: Path | None = None
    if subtitle_cues:
        subtitle_path = picture_master.parent / "captions.srt"
        write_srt(subtitle_cues, subtitle_path)
        command += ["-i", str(subtitle_path)]

    filters: list[str] = []
    mix_labels = ["[0:a]"]
    for idx, (_, spec) in enumerate(audio_tracks, start=1):
        source_in = float(spec.get("source_in") or 0)
        source_out = spec.get("source_out")
        gain_db = float(spec.get("gain_db") or 0)
        timeline_start = float(spec.get("timeline_start") or 0)
        trim = f"atrim=start={source_in:.3f}"
        if source_out is not None:
            trim += f":end={float(source_out):.3f}"
        delay_ms = max(0, round(timeline_start * 1000))
        label = f"ov{idx}"
        filters.append(
            f"[{idx}:a]{trim},asetpts=PTS-STARTPTS,aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo,volume={gain_db:.3f}dB,"
            f"adelay={delay_ms}|{delay_ms}[{label}]"
        )
        mix_labels.append(f"[{label}]")

    if audio_tracks:
        filters.append(
            f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0:normalize=0[aout]"
        )
        command += ["-filter_complex", ";".join(filters), "-map", "0:v:0", "-map", "[aout]"]
    else:
        command += ["-map", "0:v:0", "-map", "0:a:0?"]

    command += ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    if subtitle_path is not None:
        subtitle_input = 1 + len(audio_tracks)
        command += [
            "-map", f"{subtitle_input}:0",
            "-c:s", "mov_text",
            "-metadata:s:s:0", "language=eng",
            "-metadata:s:s:0", "title=English",
        ]
    command += ["-movflags", "+faststart", str(output_master)]

    proc = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace")[-1200:]
        raise AssemblyTrackError(f"Audio/subtitle finalization failed: {detail}")
    if not output_master.exists() or output_master.stat().st_size == 0:
        raise AssemblyTrackError("Track finalization completed without a master")
    return {
        "audio_overlay_count": len(audio_tracks),
        "subtitle_cue_count": len(subtitle_cues),
        "subtitle_mode": "mov_text" if subtitle_cues else "none",
        "audio_kinds": sorted({str(spec.get("kind") or "unknown") for _, spec in audio_tracks}),
    }
