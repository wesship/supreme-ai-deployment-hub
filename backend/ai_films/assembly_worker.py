"""Railway-native FFmpeg assembly worker for D3VONN.IO AI Films.

Consumes queued AI Director assembly jobs, resolves durable media sources from
``ai_film_assets``, renders a normalized master with cut/dissolve/fade support,
mixes registered dialogue/music/SFX, muxes subtitle cues, uploads the result to
private Supabase Storage, and persists deterministic job state. Google Drive
share links are deliberately treated as materialization requirements rather
than passed to FFmpeg.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote, urlparse

import httpx

from backend.ai_films.assembly_tracks import finalize_master, prepare_audio_tracks

logger = logging.getLogger(__name__)

DEFAULT_BUCKET = "ai-film-renders"
SUPPORTED_TRANSITIONS = {"cut", "dissolve", "fade", "match_cut", "audio_pre_lap", "audio_post_lap"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AssemblyWorkerError(RuntimeError):
    pass


class AssemblyBlocked(AssemblyWorkerError):
    def __init__(self, message: str, *, reason: str = "materialization_required") -> None:
        super().__init__(message)
        self.reason = reason


@dataclass(frozen=True)
class AssetSource:
    id: str
    title: str
    source_filename: str
    media_url: str
    source_type: str


class SupabaseAssemblyClient:
    def __init__(
        self,
        environ: Mapping[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        source = environ or os.environ
        self.base_url = source.get("SUPABASE_URL", "").strip().rstrip("/")
        self.service_key = source.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.bucket = source.get("AI_FILM_RENDER_BUCKET", DEFAULT_BUCKET).strip() or DEFAULT_BUCKET
        self._transport = transport
        if not self.base_url or not self.service_key:
            raise AssemblyWorkerError("Supabase assembly runtime configuration is incomplete")
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | None = None,
        payload: Mapping[str, Any] | None = None,
        representation: bool = False,
    ) -> list[dict[str, Any]]:
        headers = dict(self.headers)
        if representation:
            headers["Prefer"] = "return=representation"
        async with httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(30.0, connect=10.0),
            transport=self._transport,
        ) as client:
            response = await client.request(
                method,
                f"{self.base_url}/rest/v1/{table}",
                params=dict(params or {}),
                json=dict(payload) if payload is not None else None,
            )
        if response.status_code >= 400:
            raise AssemblyWorkerError(f"Supabase assembly request failed with HTTP {response.status_code}")
        if not response.content:
            return []
        data = response.json()
        return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []

    async def claim_next_job(self) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "ai_film_render_jobs",
            params={
                "job_type": "eq.assembly",
                "provider": "eq.ffmpeg",
                "status": "eq.queued",
                "select": "*",
                "order": "priority.desc,created_at.asc",
                "limit": "1",
            },
        )
        if not rows:
            return None
        job = rows[0]
        attempts = int(job.get("attempt_count") or 0) + 1
        claimed = await self._request(
            "PATCH",
            "ai_film_render_jobs",
            params={"id": f"eq.{job['id']}", "status": "eq.queued"},
            payload={
                "status": "processing",
                "progress": 2,
                "attempt_count": attempts,
                "started_at": _now(),
                "updated_at": _now(),
                "error_message": None,
            },
            representation=True,
        )
        return claimed[0] if claimed else None

    async def update_job(self, job_id: str, updates: Mapping[str, Any]) -> None:
        payload = dict(updates)
        payload["updated_at"] = _now()
        await self._request(
            "PATCH",
            "ai_film_render_jobs",
            params={"id": f"eq.{job_id}"},
            payload=payload,
        )

    async def get_asset(self, asset_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "ai_film_assets",
            params={
                "id": f"eq.{asset_id}",
                "select": "id,title,source_filename,storage_path,metadata,status",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    async def upload_master(self, local_path: Path, object_path: str) -> dict[str, Any]:
        data = local_path.read_bytes()
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "video/mp4",
            "x-upsert": "true",
        }
        encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0)) as client:
            response = await client.post(
                f"{self.base_url}/storage/v1/object/{quote(self.bucket, safe='')}/{encoded}",
                headers=headers,
                content=data,
            )
        if response.status_code >= 400:
            raise AssemblyWorkerError(f"Master upload failed with HTTP {response.status_code}")
        return {
            "bucket": self.bucket,
            "object_path": object_path,
            "storage_uri": f"supabase://{self.bucket}/{object_path}",
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }


def resolve_asset_source(row: Mapping[str, Any]) -> AssetSource:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    candidates = [
        metadata.get("render_url"),
        metadata.get("direct_media_url"),
        metadata.get("canonical_media_url"),
        row.get("storage_path"),
        metadata.get("source_url"),
    ]
    media_url = next((str(v).strip() for v in candidates if isinstance(v, str) and v.strip()), "")
    source_type = str(metadata.get("source_type") or "unknown")
    if not media_url:
        raise AssemblyBlocked(f"Asset {row.get('id')} has no renderable media location")
    parsed_media = urlparse(media_url)
    media_host = (parsed_media.hostname or "").lower()
    is_drive_host = media_host == "drive.google.com" or media_host.endswith(".drive.google.com")
    if is_drive_host or source_type == "google_drive":
        raise AssemblyBlocked(
            f"Asset {row.get('id')} is a private Google Drive source and must be materialized first"
        )
    if parsed_media.scheme not in {"https", "http"} or not parsed_media.netloc:
        raise AssemblyBlocked(f"Asset {row.get('id')} does not expose a server-readable media URL")
    return AssetSource(
        id=str(row.get("id") or ""),
        title=str(row.get("title") or row.get("source_filename") or row.get("id") or "asset"),
        source_filename=str(row.get("source_filename") or "asset.mp4"),
        media_url=media_url,
        source_type=source_type,
    )


def _dimensions(resolution: str) -> tuple[int, int]:
    try:
        width, height = (int(v) for v in resolution.lower().split("x", 1))
    except Exception as exc:
        raise AssemblyWorkerError(f"Invalid assembly resolution: {resolution}") from exc
    if width < 16 or height < 16:
        raise AssemblyWorkerError("Assembly resolution is too small")
    return width, height


async def _download(url: str, destination: Path) -> None:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(180.0, connect=15.0),
        ) as client:
            async with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    raise AssemblyBlocked(
                        f"Media source returned HTTP {response.status_code}",
                        reason="source_unavailable",
                    )
                with destination.open("wb") as handle:
                    async for chunk in response.aiter_bytes():
                        handle.write(chunk)
    except httpx.HTTPError as exc:
        raise AssemblyBlocked("Media source could not be downloaded", reason="source_unavailable") from exc
    if destination.stat().st_size == 0:
        raise AssemblyBlocked("Media source downloaded as an empty file", reason="source_unavailable")


async def _has_audio(path: Path) -> bool:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=index", "-of", "csv=p=0", str(path),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return proc.returncode == 0 and bool(stdout.strip())


def build_filter_complex(
    timeline: list[dict[str, Any]],
    has_audio: list[bool],
    *,
    width: int,
    height: int,
    fps: int,
    transition_seconds: float = 0.5,
) -> tuple[str, str, str, float, list[str]]:
    if not timeline:
        raise AssemblyWorkerError("Assembly timeline is empty")
    if len(timeline) != len(has_audio):
        raise AssemblyWorkerError("Audio probe count does not match timeline")

    filters: list[str] = []
    warnings: list[str] = []
    durations: list[float] = []
    for i, item in enumerate(timeline):
        start = float(item.get("source_in") or 0)
        end = float(item.get("source_out") or 0)
        duration = max(0.001, end - start)
        durations.append(duration)
        filters.append(
            f"[{i}:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS,"
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},format=yuv420p[v{i}]"
        )
        if has_audio[i]:
            filters.append(
                f"[{i}:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS,"
                f"aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}]"
            )
        else:
            filters.append(
                f"anullsrc=r=48000:cl=stereo,atrim=duration={duration:.3f},asetpts=PTS-STARTPTS[a{i}]"
            )

    current_v = "v0"
    current_a = "a0"
    current_duration = durations[0]
    for i in range(1, len(timeline)):
        transition = str(timeline[i].get("transition_in") or timeline[i - 1].get("transition_out") or "cut")
        if transition not in SUPPORTED_TRANSITIONS:
            warnings.append(f"Unsupported transition '{transition}' downgraded to cut at clip {i + 1}")
            transition = "cut"
        next_v = f"v{i}"
        next_a = f"a{i}"
        out_v = f"vx{i}"
        out_a = f"ax{i}"
        if transition in {"dissolve", "fade"}:
            d = min(transition_seconds, current_duration / 3, durations[i] / 3)
            d = max(0.08, d)
            offset = max(0.0, current_duration - d)
            filters.append(
                f"[{current_v}][{next_v}]xfade=transition=fade:duration={d:.3f}:offset={offset:.3f}[{out_v}]"
            )
            filters.append(f"[{current_a}][{next_a}]acrossfade=d={d:.3f}:c1=tri:c2=tri[{out_a}]")
            current_duration = current_duration + durations[i] - d
        else:
            if transition in {"match_cut", "audio_pre_lap", "audio_post_lap"}:
                warnings.append(f"Transition '{transition}' rendered as deterministic cut at clip {i + 1}")
            filters.append(f"[{current_v}][{current_a}][{next_v}][{next_a}]concat=n=2:v=1:a=1[{out_v}][{out_a}]")
            current_duration += durations[i]
        current_v, current_a = out_v, out_a
    return ";".join(filters), current_v, current_a, current_duration, warnings


async def _run_ffmpeg(
    sources: list[Path],
    timeline: list[dict[str, Any]],
    output_path: Path,
    *,
    resolution: str,
    fps: int,
) -> dict[str, Any]:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise AssemblyWorkerError("FFmpeg/ffprobe is not installed in the Railway image")
    width, height = _dimensions(resolution)
    audio_flags = [await _has_audio(path) for path in sources]
    filter_complex, video_label, audio_label, runtime, warnings = build_filter_complex(
        timeline, audio_flags, width=width, height=height, fps=fps
    )
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for path in sources:
        command += ["-i", str(path)]
    command += [
        "-filter_complex", filter_complex,
        "-map", f"[{video_label}]", "-map", f"[{audio_label}]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", "-r", str(fps), str(output_path),
    ]
    proc = await asyncio.create_subprocess_exec(
        *command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace")[-1200:]
        raise AssemblyWorkerError(f"FFmpeg assembly failed: {detail}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise AssemblyWorkerError("FFmpeg completed without creating a master")
    return {"runtime_seconds": round(runtime, 3), "warnings": warnings, "command_version": "ffmpeg-v1.1"}


async def process_assembly_job(job: Mapping[str, Any], db: SupabaseAssemblyClient) -> dict[str, Any]:
    job_id = str(job.get("id") or "")
    project_id = str(job.get("project_id") or "")
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    timeline = payload.get("timeline") if isinstance(payload.get("timeline"), list) else []
    audio_specs = payload.get("audio_tracks") if isinstance(payload.get("audio_tracks"), list) else []
    subtitle_cues = payload.get("subtitle_cues") if isinstance(payload.get("subtitle_cues"), list) else []
    if not job_id or not project_id or not timeline:
        raise AssemblyWorkerError("Assembly job is missing id/project/timeline")

    assets: list[AssetSource] = []
    blocked: list[dict[str, str]] = []
    for item in timeline:
        asset_id = str(item.get("asset_id") or "")
        row = await db.get_asset(asset_id)
        if not row:
            blocked.append({"asset_id": asset_id, "reason": "asset_not_registered"})
            continue
        try:
            assets.append(resolve_asset_source(row))
        except AssemblyBlocked as exc:
            blocked.append({"asset_id": asset_id, "reason": exc.reason})
    if blocked:
        raise AssemblyBlocked(
            json.dumps(
                {"message": "One or more timeline assets require materialization", "assets": blocked},
                separators=(",", ":"),
            )
        )
    if len(assets) != len(timeline):
        raise AssemblyWorkerError("Resolved asset count does not match timeline")

    await db.update_job(job_id, {"progress": 10})
    with tempfile.TemporaryDirectory(prefix=f"d3vonn-assembly-{job_id[:8]}-") as tempdir:
        root = Path(tempdir)
        local_sources: list[Path] = []
        for index, source in enumerate(assets):
            suffix = Path(source.source_filename).suffix or ".mp4"
            target = root / f"source-{index:03d}{suffix}"
            await _download(source.media_url, target)
            local_sources.append(target)
            await db.update_job(job_id, {"progress": min(40, 12 + int((index + 1) / len(assets) * 28))})

        prepared_audio = await prepare_audio_tracks(
            db,
            [spec for spec in audio_specs if isinstance(spec, dict)],
            root,
            resolve_asset=resolve_asset_source,
            download=_download,
        )
        await db.update_job(job_id, {"progress": 48 if prepared_audio else 42})

        picture_master = root / "picture-master.mp4"
        master = root / "master.mp4"
        render_meta = await _run_ffmpeg(
            local_sources,
            timeline,
            picture_master,
            resolution=str(payload.get("resolution") or "1920x1080"),
            fps=int(payload.get("fps") or 24),
        )
        await db.update_job(job_id, {"progress": 78})

        track_meta = await finalize_master(
            picture_master,
            master,
            audio_tracks=prepared_audio,
            subtitle_cues=[cue for cue in subtitle_cues if isinstance(cue, dict)],
        )
        await db.update_job(job_id, {"progress": 88})

        safe_title = "".join(
            ch if ch.isalnum() or ch in "-_" else "-"
            for ch in str(payload.get("title") or "master")
        )[:80].strip("-") or "master"
        object_path = f"{project_id}/assembly/{job_id}/{safe_title}.mp4"
        stored = await db.upload_master(master, object_path)
        output = {
            **stored,
            **render_meta,
            **track_meta,
            "title": payload.get("title"),
            "timeline_clip_count": len(timeline),
            "source_asset_ids": [a.id for a in assets],
            "audio_asset_ids": [str(spec.get("asset_id")) for spec in audio_specs if isinstance(spec, dict)],
            "qa": {
                "continuity_requested": bool((payload.get("qa") or {}).get("continuity")),
                "final_twelvelabs_analyze_requested": bool((payload.get("qa") or {}).get("final_twelvelabs_analyze")),
                "jockey_corpus_reasoning_requested": bool((payload.get("qa") or {}).get("jockey_corpus_reasoning")),
                "state": "pending_post_render_qa",
            },
        }
        await db.update_job(
            job_id,
            {
                "status": "completed",
                "progress": 100,
                "output": output,
                "completed_at": _now(),
                "error_message": None,
            },
        )
        return output


async def run_assembly_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if source.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() != "production":
        logger.info("AI Films assembly worker skipped outside production Railway.")
        return
    if source.get("AI_FILM_ASSEMBLY_WORKER_ENABLED", "true").strip().lower() in {"0", "false", "no", "off"}:
        logger.info("AI Films assembly worker disabled by environment.")
        return
    db = SupabaseAssemblyClient(source)
    poll_seconds = max(2.0, float(source.get("AI_FILM_ASSEMBLY_POLL_SECONDS", "8") or 8))
    while True:
        job = await db.claim_next_job()
        if not job:
            if once:
                return
            await asyncio.sleep(poll_seconds)
            continue
        job_id = str(job.get("id") or "")
        try:
            await process_assembly_job(job, db)
            logger.info("AI Films assembly completed for job %s", job_id)
        except AssemblyBlocked as exc:
            logger.warning("AI Films assembly blocked for job %s: %s", job_id, exc)
            await db.update_job(
                job_id,
                {
                    "status": "blocked",
                    "progress": 0,
                    "error_message": str(exc)[:2000],
                    "output": {"blocked_reason": exc.reason, "retryable": True},
                },
            )
        except Exception as exc:
            logger.exception("AI Films assembly failed for job %s", job_id)
            await db.update_job(
                job_id,
                {
                    "status": "failed",
                    "progress": 0,
                    "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                },
            )
        if once:
            return
