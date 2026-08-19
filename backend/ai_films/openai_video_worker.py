"""OpenAI/Sora execution worker for AI Films multimodel video jobs.

Execution is opt-in through AI_FILM_GENERATION_EXECUTION_ENABLED=true. The
worker consumes dispatcher-created video jobs, renders with OpenAI Videos using
an approved anchor image when present, stores the MP4 privately, registers an AI
Films asset, and marks the result for post-generation TwelveLabs/Jockey QA.
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


class OpenAIVideoWorkerError(RuntimeError):
    pass


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_GENERATION_EXECUTION_ENABLED", "false")).strip().lower() in {"1", "true", "yes", "on"}


def _duration(value: Any) -> str:
    target = float(value or 4)
    return str(min((4, 8, 12), key=lambda option: (abs(option - target), option)))


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
    return "\n".join(part for part in parts if part)[:12000]


def _reference_asset_id(packet: Mapping[str, Any]) -> str | None:
    shot_anchors = packet.get("anchor_frame_asset_ids")
    if isinstance(shot_anchors, list) and shot_anchors:
        return str(shot_anchors[0])
    locks = packet.get("character_locks") if isinstance(packet.get("character_locks"), dict) else {}
    if len(locks) == 1:
        lock = next(iter(locks.values()))
        anchors = lock.get("anchor_asset_ids") if isinstance(lock, dict) else None
        if isinstance(anchors, list) and anchors:
            return str(anchors[0])
    return None


async def _load_reference(db: SupabaseAssemblyClient, asset_id: str) -> tuple[str, bytes, str]:
    rows = await db._request(
        "GET", "ai_film_assets",
        params={"id": f"eq.{asset_id}", "asset_type": "eq.image", "status": "eq.canon", "select": "id,source_filename,metadata", "limit": "1"},
    )
    if not rows:
        raise OpenAIVideoWorkerError("Approved canon anchor image is unavailable")
    row = rows[0]
    meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    object_path = str(meta.get("storage_object_path") or "")
    if not object_path:
        raise OpenAIVideoWorkerError("Canon anchor has no private storage object path")
    signed_url = await _sign_master(db, object_path, expires_in=900)
    async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=15), follow_redirects=True) as client:
        response = await client.get(signed_url)
    if response.status_code >= 400 or not response.content:
        raise OpenAIVideoWorkerError(f"Canon anchor download failed with HTTP {response.status_code}")
    filename = str(row.get("source_filename") or "anchor.jpg")
    content_type = response.headers.get("content-type") or "image/jpeg"
    return filename, response.content, content_type


class OpenAIVideoClient:
    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        source = environ or os.environ
        # Railway production historically stores the project key as OpenAiKey.
        # Prefer that canonical deployment variable, while retaining the
        # conventional OPENAI_API_KEY fallback used by VPS/CI/local runs.
        self.api_key = str(source.get("OpenAiKey") or source.get("OPENAI_API_KEY") or "").strip()
        self.model = str(source.get("AI_FILM_OPENAI_VIDEO_MODEL", "sora-2")).strip() or "sora-2"
        self.base_url = str(source.get("OPENAI_API_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
        if not self.api_key:
            raise OpenAIVideoWorkerError("OpenAiKey/OPENAI_API_KEY is not configured")
        self.headers = {"Authorization": f"Bearer {self.api_key}"}

    async def create(
        self,
        prompt: str,
        *,
        seconds: str,
        size: str = "1280x720",
        input_reference: tuple[str, bytes, str] | None = None,
    ) -> dict[str, Any]:
        files = None
        if input_reference is not None:
            filename, content, content_type = input_reference
            files = {"input_reference": (filename, content, content_type)}
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=15.0)) as client:
            response = await client.post(
                f"{self.base_url}/videos",
                headers=self.headers,
                data={"model": self.model, "prompt": prompt, "seconds": seconds, "size": size},
                files=files,
            )
        if response.status_code >= 400:
            raise OpenAIVideoWorkerError(f"OpenAI video create failed with HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("id"):
            raise OpenAIVideoWorkerError("OpenAI video create returned no job id")
        return payload

    async def retrieve(self, video_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=15.0)) as client:
            response = await client.get(f"{self.base_url}/videos/{video_id}", headers=self.headers)
        if response.status_code >= 400:
            raise OpenAIVideoWorkerError(f"OpenAI video retrieve failed with HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, dict):
            raise OpenAIVideoWorkerError("OpenAI video retrieve returned invalid JSON")
        return payload

    async def wait(self, video_id: str, *, timeout_seconds: float = 1800.0) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            payload = await self.retrieve(video_id)
            status = str(payload.get("status") or "").lower()
            if status == "completed":
                return payload
            if status in {"failed", "cancelled"}:
                raise OpenAIVideoWorkerError(f"OpenAI video generation ended with status {status}")
            if asyncio.get_running_loop().time() >= deadline:
                raise OpenAIVideoWorkerError("OpenAI video generation timed out")
            await asyncio.sleep(10)

    async def download(self, video_id: str) -> bytes:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/videos/{video_id}/content", headers=self.headers)
        if response.status_code >= 400 or not response.content:
            raise OpenAIVideoWorkerError(f"OpenAI video download failed with HTTP {response.status_code}")
        return response.content


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET", "ai_film_render_jobs",
        params={"job_type": "eq.video", "provider": "eq.openai", "status": "eq.queued", "select": "*", "order": "priority.desc,created_at.asc", "limit": "1"},
    )
    if not rows:
        return None
    job = rows[0]
    claimed = await db._request(
        "PATCH", "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "status": "eq.queued"},
        payload={"status": "processing", "progress": 2, "started_at": _now(), "updated_at": _now(), "error_message": None, "attempt_count": int(job.get("attempt_count") or 0) + 1},
        representation=True,
    )
    return claimed[0] if claimed else None


async def process_openai_video_job(job: Mapping[str, Any], db: SupabaseAssemblyClient, environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = environ or os.environ
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = payload.get("generation_packet") if isinstance(payload.get("generation_packet"), dict) else {}
    shot_id = str(payload.get("shot_id") or packet.get("shot_id") or "")
    if not shot_id:
        raise OpenAIVideoWorkerError("Video job is missing shot_id")
    reference_id = _reference_asset_id(packet)
    reference = await _load_reference(db, reference_id) if reference_id else None
    if packet.get("character_locks") and reference is None:
        raise OpenAIVideoWorkerError("Character generation requires an approved input reference")

    client = OpenAIVideoClient(source)
    seconds = _duration(packet.get("duration_target_seconds"))
    created = await client.create(_prompt(packet), seconds=seconds, size="1280x720", input_reference=reference)
    provider_job_id = str(created.get("id"))
    await db.update_job(str(job["id"]), {"progress": 8, "output": {"provider_job_id": provider_job_id, "provider_model": created.get("model") or client.model, "provider_status": created.get("status"), "input_reference_asset_id": reference_id}})
    completed = await client.wait(provider_job_id)
    await db.update_job(str(job["id"]), {"progress": 82})
    media = await client.download(provider_job_id)

    with tempfile.TemporaryDirectory(prefix="d3vonn-sora-") as tmp:
        master = Path(tmp) / f"{shot_id}.mp4"
        master.write_bytes(media)
        object_path = f"{job['project_id']}/generated/{job['id']}/{shot_id}.mp4"
        stored = await db.upload_master(master, object_path)

    asset_payload = {
        "project_id": job["project_id"], "owner_id": job["owner_id"], "asset_type": "video",
        "title": f"{shot_id} — generated", "description": "AI Films generated shot awaiting TwelveLabs/Jockey canon QA.",
        "storage_path": object_path, "source_filename": f"{shot_id}.mp4", "category": "generated", "subcategory": "shot",
        "status": "selected", "version": 1, "tags": ["ai-films", "generated", shot_id, "openai"],
        "metadata": {"source_type": "generated", "provider": "openai", "provider_video_id": provider_job_id, "provider_model": completed.get("model") or client.model, "shot_id": shot_id, "render_job_id": str(job["id"]), "storage_bucket": db.bucket, "storage_object_path": object_path, "input_reference_asset_id": reference_id, "qa_state": "pending_generated_qa"},
        "checksum": stored.get("sha256"),
    }
    assets = await db._request("POST", "ai_film_assets", payload=asset_payload, representation=True)
    asset_id = str(assets[0]["id"]) if assets else ""
    output = {**stored, "provider_job_id": provider_job_id, "provider_model": completed.get("model") or client.model, "provider_status": "completed", "input_reference_asset_id": reference_id, "generated_asset_id": asset_id, "shot_id": shot_id, "seconds": completed.get("seconds") or seconds, "size": completed.get("size") or "1280x720", "qa": {"state": "pending_generated_qa"}}
    await db.update_job(str(job["id"]), {"status": "completed", "progress": 100, "completed_at": _now(), "output": output})
    return output


async def run_openai_video_worker(*, environ: Mapping[str, str] | None = None, once: bool = False) -> None:
    source = environ or os.environ
    # This worker runs on both Railway and the production VPS. Treat the
    # normalized application environment as authoritative instead of requiring
    # a Railway-only variable that is absent on non-Railway deployments.
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production":
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
            await process_openai_video_job(job, db, source)
        except Exception as exc:
            await db.update_job(str(job["id"]), {"status": "failed", "error_message": f"{type(exc).__name__}: {exc}"[:2000], "completed_at": _now()})
        if once:
            return
