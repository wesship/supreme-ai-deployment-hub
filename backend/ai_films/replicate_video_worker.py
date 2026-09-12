"""First-class Replicate general-video worker for AI Films.

The queue runner remains fail-closed behind the provider activation contract.
The processing function is separately callable by the protected certification
canary so a single bounded render can be proven before activation.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

import httpx

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.generation_lifecycle import provider_cost_metadata
from backend.ai_films.pollo_video_worker import (
    _duration,
    _load_reference_url,
    _prompt,
    _reference_asset_id,
)
from backend.ai_films.provider_activation import activation_status
from backend.ai_films.replicate_video_fallback import (
    ReplicateVideoClient,
    ReplicateVideoFallbackError,
)


class ReplicateVideoWorkerError(RuntimeError):
    pass


async def _claim_replicate(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "eq.replicate",
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
        "PATCH",
        "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "status": "eq.queued"},
        payload={
            "status": "processing",
            "progress": 2,
            "started_at": _now(),
            "updated_at": _now(),
            "error_message": None,
            "attempt_count": int(job.get("attempt_count") or 0) + 1,
        },
        representation=True,
    )
    return claimed[0] if claimed else None


async def process_replicate_video_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    input_payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = input_payload.get("generation_packet") if isinstance(input_payload.get("generation_packet"), dict) else {}
    shot_id = str(input_payload.get("shot_id") or packet.get("shot_id") or "").strip()
    if not shot_id:
        raise ReplicateVideoWorkerError("Video job is missing shot_id")

    reference_id = _reference_asset_id(packet)
    image_url = await _load_reference_url(db, reference_id) if reference_id else None
    if packet.get("character_locks") and image_url is None:
        raise ReplicateVideoWorkerError("Character generation requires an approved input reference")

    try:
        client = ReplicateVideoClient(source)
    except ReplicateVideoFallbackError as exc:
        raise ReplicateVideoWorkerError(str(exc)) from exc

    seconds = _duration(packet.get("duration_target_seconds"))
    existing_output = dict(job.get("output") or {})
    prediction_id = str(existing_output.get("provider_task_id") or "").strip()
    created: dict[str, Any] = {}

    if prediction_id:
        output = dict(existing_output)
        output.update(
            {
                "provider_task_id": prediction_id,
                "provider_model": str(existing_output.get("provider_model") or client.model),
                "provider_status": str(existing_output.get("provider_status") or "waiting"),
                "input_reference_asset_id": existing_output.get("input_reference_asset_id", reference_id),
                "resume_state": "resumed_existing_provider_task",
            }
        )
        await db.update_job(str(job["id"]), {"progress": max(8, int(job.get("progress") or 0)), "output": output})
    else:
        created = await client.create(_prompt(packet), seconds=seconds, image_url=image_url)
        prediction_id = str(created.get("id") or "").strip()
        if not prediction_id:
            raise ReplicateVideoWorkerError("Replicate create returned no prediction id")
        output = {
            "provider_task_id": prediction_id,
            "provider_model": client.model,
            "provider_status": str(created.get("status") or "starting"),
            "input_reference_asset_id": reference_id,
        }
        await db.update_job(str(job["id"]), {"progress": 8, "output": output})

    try:
        completed = await client.wait(prediction_id)
    except ReplicateVideoFallbackError as exc:
        raise ReplicateVideoWorkerError(str(exc)) from exc

    media_url = str(completed.get("url") or "").strip()
    if not media_url:
        raise ReplicateVideoWorkerError("Replicate completed without a media URL")

    await db.update_job(str(job["id"]), {"progress": 82})
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True) as http:
        response = await http.get(media_url)
    if response.status_code >= 400 or not response.content:
        raise ReplicateVideoWorkerError(f"Replicate video download failed with HTTP {response.status_code}")

    with tempfile.TemporaryDirectory(prefix="d3vonn-replicate-video-") as tmp:
        master = Path(tmp) / f"{shot_id}.mp4"
        master.write_bytes(response.content)
        object_path = f"{job['project_id']}/generated/{job['id']}/{shot_id}-replicate.mp4"
        stored = await db.upload_master(master, object_path)

    asset_payload = {
        "project_id": job["project_id"],
        "owner_id": job["owner_id"],
        "asset_type": "video",
        "title": f"{shot_id} — generated",
        "description": "AI Films Replicate-generated shot awaiting TwelveLabs/Jockey canon QA.",
        "storage_path": object_path,
        "source_filename": f"{shot_id}-replicate.mp4",
        "category": "generated",
        "subcategory": "shot",
        "status": "selected",
        "version": 1,
        "tags": ["ai-films", "generated", shot_id, "replicate"],
        "metadata": {
            "source_type": "generated",
            "provider": "replicate",
            "provider_task_id": prediction_id,
            "provider_model": client.model,
            "shot_id": shot_id,
            "render_job_id": str(job["id"]),
            "storage_bucket": db.bucket,
            "storage_object_path": object_path,
            "input_reference_asset_id": reference_id,
            "qa_state": "pending_generated_qa",
        },
        "checksum": stored.get("sha256"),
    }
    assets = await db._request("POST", "ai_film_assets", payload=asset_payload, representation=True)
    asset_id = str(assets[0]["id"]) if assets else ""

    output = {
        **stored,
        "provider_task_id": prediction_id,
        "provider_model": client.model,
        "provider_status": "completed",
        "input_reference_asset_id": reference_id,
        "generated_asset_id": asset_id,
        "shot_id": shot_id,
        "qa": {"state": "pending_generated_qa"},
    }
    prediction = completed.get("prediction") if isinstance(completed.get("prediction"), dict) else None
    cost_metadata = provider_cost_metadata(
        created,
        prediction,
        provider="replicate",
        model=client.model,
        seconds=seconds,
        size="720p:16:9",
    )
    await db.update_job(
        str(job["id"]),
        {
            "status": "completed",
            "progress": 100,
            "completed_at": _now(),
            "updated_at": _now(),
            "error_message": None,
            "output": output,
            "result_asset_id": asset_id or None,
            "result_storage_path": object_path,
            "cost_metadata": cost_metadata,
        },
    )
    return output


async def run_replicate_video_worker(*, environ: Mapping[str, str] | None = None, once: bool = False) -> None:
    source = environ or os.environ
    runtime_environment = str(source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or "").strip().lower()
    if runtime_environment != "production":
        return
    if not activation_status("replicate", source).executable:
        return

    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_VIDEO_WORKER_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim_replicate(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await process_replicate_video_job(job, db, source)
        except Exception as exc:
            await db.update_job(
                str(job["id"]),
                {
                    "status": "failed",
                    "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                    "completed_at": _now(),
                    "updated_at": _now(),
                },
            )
        if once:
            return
