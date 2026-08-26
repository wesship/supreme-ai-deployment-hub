"""Queue worker for self-hosted D3VONN AI Films video generation.

Consumes ``ai_film_render_jobs`` video rows, dispatches to the configured local
Wan/LTX runner, uploads the resulting MP4 to private Supabase Storage, and
persists deterministic job state. The worker is intentionally provider-neutral:
model runtimes stay outside the API container.
"""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.local_video_worker import run_local_video


class LocalVideoQueueWorkerError(RuntimeError):
    pass


async def claim_next_local_video_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET", "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "in.(wan,ltx)",
            "status": "eq.queued",
            "select": "*",
            "order": "priority.desc,created_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    claimed = await db._request(
        "PATCH", "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "status": "eq.queued"},
        payload={
            "status": "processing",
            "progress": 2,
            "attempt_count": int(job.get("attempt_count") or 0) + 1,
            "started_at": _now(),
            "updated_at": _now(),
            "error_message": None,
        },
        representation=True,
    )
    return claimed[0] if claimed else None


async def _upload_video(db: SupabaseAssemblyClient, local_path: Path, job: Mapping[str, Any]) -> dict[str, Any]:
    project_id = str(job.get("project_id") or "unknown")
    shot_id = str((job.get("input") or {}).get("shot_id") or "unknown")
    provider = str(job.get("provider") or "local")
    object_path = f"generated/{project_id}/shots/{shot_id}/{provider}/{job['id']}.mp4"
    return await db.upload_master(local_path, object_path)


async def process_local_video_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    provider = str(job.get("provider") or "").strip().lower()
    if provider not in {"wan", "ltx"}:
        raise LocalVideoQueueWorkerError(f"unsupported local provider: {provider}")
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = payload.get("generation_packet") if isinstance(payload.get("generation_packet"), dict) else {}
    if not packet:
        raise LocalVideoQueueWorkerError("video job is missing generation_packet")

    with tempfile.TemporaryDirectory(prefix="d3vonn-video-") as temp_dir:
        root = Path(temp_dir)
        packet_path = root / "generation_packet.json"
        output_path = root / "output.mp4"
        packet_path.write_text(json.dumps(packet, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        await db._request(
            "PATCH", "ai_film_render_jobs",
            params={"id": f"eq.{job['id']}"},
            payload={"progress": 5, "output": {"phase": "local_generation", "provider": provider}},
        )
        result = await asyncio.to_thread(
            run_local_video,
            str(packet_path),
            str(output_path),
            provider=provider,
            environ=source,
        )
        artifact = await _upload_video(db, output_path, job)

    output = {
        "phase": "generated",
        "provider": provider,
        "model": payload.get("selected_model"),
        "storage": artifact,
        "worker": "local-video-queue-v1",
    }
    await db._request(
        "PATCH", "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}"},
        payload={
            "status": "completed",
            "progress": 100,
            "output": output,
            "completed_at": _now(),
            "updated_at": _now(),
            "error_message": None,
        },
    )
    return {"job_id": str(job["id"]), "status": "completed", "output": output, "runner": result.provider}


async def run_once(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = environ or os.environ
    if str(source.get("AI_FILM_GENERATION_EXECUTION_ENABLED", "false")).strip().lower() not in {"1", "true", "yes", "on"}:
        return {"status": "disabled"}
    db = SupabaseAssemblyClient(source)
    job = await claim_next_local_video_job(db)
    if job is None:
        return {"status": "idle"}
    try:
        return await process_local_video_job(job, db, source)
    except Exception as exc:
        message = str(exc)[:2000]
        await db._request(
            "PATCH", "ai_film_render_jobs",
            params={"id": f"eq.{job['id']}"},
            payload={"status": "failed", "progress": 100, "error_message": message, "updated_at": _now()},
        )
        return {"job_id": str(job["id"]), "status": "failed", "error": message}


async def worker_loop(environ: Mapping[str, str] | None = None) -> None:
    source = environ or os.environ
    interval = max(1.0, float(source.get("AI_FILM_VIDEO_WORKER_POLL_SECONDS", "5")))
    while True:
        result = await run_once(source)
        if result.get("status") == "disabled":
            return
        await asyncio.sleep(0.1 if result.get("status") in {"completed", "failed"} else interval)


if __name__ == "__main__":
    asyncio.run(worker_loop())
