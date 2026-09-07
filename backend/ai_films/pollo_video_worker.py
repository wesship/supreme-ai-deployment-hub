"""Pollo v2.5 execution worker for AI Films render jobs.

This worker replaces the legacy OpenAI/Sora execution path for production video
jobs. It claims ``video/pollo`` render jobs, submits them to Pollo, polls the
authoritative task result, downloads the generated MP4, stores it in private AI
Films storage, registers an asset, and marks the job ready for generated-shot
TwelveLabs/Jockey QA.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

import httpx

from backend.ai_films.assembly_qa_worker import _sign_master
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.commerce_handoff_worker import CommerceHandoffPending, fetch_pollo_result, _task_generations


class PolloVideoWorkerError(RuntimeError):
    pass


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_GENERATION_EXECUTION_ENABLED", "false")).strip().lower() in {
        "1", "true", "yes", "on"
    }


def _duration(value: Any) -> int:
    target = int(float(value or 4))
    return max(4, min(10, target))


def _prompt(packet: Mapping[str, Any]) -> str:
    parts = [str(packet.get("generation_prompt") or "").strip()]
    negative = str(packet.get("negative_prompt") or "").strip()
    if negative:
        parts.append(f"Avoid: {negative}")
    locks = packet.get("continuity_locks")
    if isinstance(locks, list) and locks:
        parts.append("Continuity locks: " + "; ".join(str(v) for v in locks))
    camera = packet.get("camera")
    if isinstance(camera, dict) and camera:
        parts.append("Camera: " + "; ".join(f"{k}={v}" for k, v in camera.items()))
    lighting = packet.get("lighting")
    if isinstance(lighting, dict) and lighting:
        parts.append("Lighting: " + "; ".join(f"{k}={v}" for k, v in lighting.items()))
    return "\n".join(part for part in parts if part)[:5000]


def _reference_asset_id(packet: Mapping[str, Any]) -> str | None:
    anchors = packet.get("anchor_frame_asset_ids")
    if isinstance(anchors, list) and anchors:
        return str(anchors[0])
    locks = packet.get("character_locks") if isinstance(packet.get("character_locks"), dict) else {}
    if len(locks) == 1:
        lock = next(iter(locks.values()))
        anchor_ids = lock.get("anchor_asset_ids") if isinstance(lock, dict) else None
        if isinstance(anchor_ids, list) and anchor_ids:
            return str(anchor_ids[0])
    return None


async def _load_reference_url(db: SupabaseAssemblyClient, asset_id: str) -> str:
    rows = await db._request(
        "GET",
        "ai_film_assets",
        params={
            "id": f"eq.{asset_id}",
            "asset_type": "eq.image",
            "status": "eq.canon",
            "select": "id,metadata",
            "limit": "1",
        },
    )
    if not rows:
        raise PolloVideoWorkerError("Approved canon anchor image is unavailable")
    metadata = rows[0].get("metadata") if isinstance(rows[0].get("metadata"), dict) else {}
    object_path = str(metadata.get("storage_object_path") or "")
    if not object_path:
        raise PolloVideoWorkerError("Canon anchor has no private storage object path")
    return await _sign_master(db, object_path, expires_in=1800)


class PolloVideoClient:
    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        source = environ or os.environ
        self.api_key = str(source.get("POLLO_API_KEY", "")).strip()
        self.base_url = str(source.get("POLLO_API_BASE_URL", "https://pollo.ai/api/platform")).strip().rstrip("/")
        self.model = str(source.get("AI_FILM_POLLO_VIDEO_MODEL", "pollo-v2-5")).strip() or "pollo-v2-5"
        if not self.api_key:
            raise PolloVideoWorkerError("POLLO_API_KEY is not configured")

    async def create(self, prompt: str, *, seconds: int, image_url: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "input": {
                "prompt": prompt,
                "length": seconds,
                "resolution": "720p",
                "mode": "basic",
                "generateAudio": False,
            },
            "clientSource": "d3vonn-ai-films-render-worker",
        }
        if image_url:
            payload["input"]["image"] = image_url
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                f"{self.base_url}/generation/pollo/{self.model}",
                json=payload,
                headers={"x-api-key": self.api_key, "Accept": "application/json"},
            )
        if response.status_code >= 400:
            detail = response.text[:1000].strip()
            raise PolloVideoWorkerError(
                f"Pollo video create failed with HTTP {response.status_code}: {detail}"
            )
        try:
            result = response.json()
        except ValueError as exc:
            raise PolloVideoWorkerError("Pollo video create returned invalid JSON") from exc
        task_id = str(result.get("taskId") or "").strip() if isinstance(result, dict) else ""
        if not task_id:
            raise PolloVideoWorkerError("Pollo video create returned no taskId")
        return result

    async def wait(self, task_id: str, *, timeout_seconds: float = 1800.0) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            task = await fetch_pollo_result(
                task_id,
                {"POLLO_API_KEY": self.api_key, "POLLO_API_BASE_URL": self.base_url},
            )
            try:
                generations, urls = _task_generations(task)
                return {"task": task, "generations": generations, "urls": urls}
            except CommerceHandoffPending:
                pass
            if asyncio.get_running_loop().time() >= deadline:
                raise PolloVideoWorkerError("Pollo video generation timed out")
            await asyncio.sleep(8)


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET", "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "eq.pollo",
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


async def process_pollo_video_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = payload.get("generation_packet") if isinstance(payload.get("generation_packet"), dict) else {}
    shot_id = str(payload.get("shot_id") or packet.get("shot_id") or "")
    if not shot_id:
        raise PolloVideoWorkerError("Video job is missing shot_id")

    reference_id = _reference_asset_id(packet)
    image_url = await _load_reference_url(db, reference_id) if reference_id else None
    if packet.get("character_locks") and image_url is None:
        raise PolloVideoWorkerError("Character generation requires an approved input reference")

    client = PolloVideoClient(source)
    created = await client.create(
        _prompt(packet),
        seconds=_duration(packet.get("duration_target_seconds")),
        image_url=image_url,
    )
    task_id = str(created.get("taskId"))
    await db.update_job(
        str(job["id"]),
        {
            "progress": 8,
            "output": {
                "provider_task_id": task_id,
                "provider_model": client.model,
                "provider_status": created.get("status") or "submitted",
                "input_reference_asset_id": reference_id,
            },
        },
    )

    completed = await client.wait(task_id)
    media_url = str(completed["urls"][0])
    await db.update_job(str(job["id"]), {"progress": 82})
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True) as http:
        response = await http.get(media_url)
    if response.status_code >= 400 or not response.content:
        raise PolloVideoWorkerError(f"Pollo video download failed with HTTP {response.status_code}")

    with tempfile.TemporaryDirectory(prefix="d3vonn-pollo-") as tmp:
        master = Path(tmp) / f"{shot_id}.mp4"
        master.write_bytes(response.content)
        object_path = f"{job['project_id']}/generated/{job['id']}/{shot_id}.mp4"
        stored = await db.upload_master(master, object_path)

    asset_payload = {
        "project_id": job["project_id"],
        "owner_id": job["owner_id"],
        "asset_type": "video",
        "title": f"{shot_id} — generated",
        "description": "AI Films Pollo-generated shot awaiting TwelveLabs/Jockey canon QA.",
        "storage_path": object_path,
        "source_filename": f"{shot_id}.mp4",
        "category": "generated",
        "subcategory": "shot",
        "status": "selected",
        "version": 1,
        "tags": ["ai-films", "generated", shot_id, "pollo"],
        "metadata": {
            "source_type": "generated",
            "provider": "pollo",
            "provider_task_id": task_id,
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
        "provider_task_id": task_id,
        "provider_model": client.model,
        "provider_status": "completed",
        "provider_media_url": media_url,
        "input_reference_asset_id": reference_id,
        "generated_asset_id": asset_id,
        "shot_id": shot_id,
        "qa": {"state": "pending_generated_qa"},
    }
    await db.update_job(
        str(job["id"]),
        {"status": "completed", "progress": 100, "completed_at": _now(), "output": output},
    )
    return output


async def run_pollo_video_worker(*, environ: Mapping[str, str] | None = None, once: bool = False) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_VIDEO_WORKER_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await process_pollo_video_job(job, db, source)
        except Exception as exc:
            await db.update_job(
                str(job["id"]),
                {
                    "status": "failed",
                    "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                    "completed_at": _now(),
                },
            )
        if once:
            return
