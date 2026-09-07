"""Replicate Seedance fallback executor for AI Films video jobs.

This module is intentionally not an always-on queue worker. Pollo remains the
primary renderer and invokes this executor only after a retryable provider-side
failure. That keeps ownership deterministic and prevents duplicate paid renders.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote

import httpx

from backend.ai_films.assembly_qa_worker import _sign_master
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.pollo_video_worker import _duration, _load_reference_url, _prompt, _reference_asset_id


class ReplicateVideoFallbackError(RuntimeError):
    pass


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_REPLICATE_VIDEO_FAILOVER_ENABLED", "true")).strip().lower() in {
        "1", "true", "yes", "on"
    }


def is_retryable_pollo_failure(exc: Exception) -> bool:
    """Only provider/network failures may spend money on a fallback render."""
    text = f"{type(exc).__name__}: {exc}".lower()
    retryable_markers = (
        "http 429",
        "http 5",
        "timeout",
        "timed out",
        "connect",
        "connection",
        "network",
        "temporarily unavailable",
        "service unavailable",
        "could not be completed",
    )
    return any(marker in text for marker in retryable_markers)


class ReplicateVideoClient:
    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        source = environ or os.environ
        self.api_token = str(source.get("REPLICATE_API_TOKEN", "")).strip()
        self.model = str(
            source.get("AI_FILM_REPLICATE_VIDEO_MODEL", "bytedance/seedance-1-lite")
        ).strip() or "bytedance/seedance-1-lite"
        self.base_url = "https://api.replicate.com/v1"
        if not self.api_token:
            raise ReplicateVideoFallbackError("REPLICATE_API_TOKEN is not configured")
        if "/" not in self.model:
            raise ReplicateVideoFallbackError("AI_FILM_REPLICATE_VIDEO_MODEL must be owner/model")

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def create(self, prompt: str, *, seconds: int, image_url: str | None = None) -> dict[str, Any]:
        owner, name = self.model.split("/", 1)
        input_payload: dict[str, Any] = {
            "prompt": prompt,
            "duration": max(4, min(12, int(seconds))),
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "fps": 24,
            "camera_fixed": False,
        }
        if image_url:
            input_payload["image"] = image_url
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            response = await client.post(
                f"{self.base_url}/models/{quote(owner, safe='')}/{quote(name, safe='')}/predictions",
                headers=self.headers,
                json={"input": input_payload},
            )
        if response.status_code >= 400:
            raise ReplicateVideoFallbackError(
                f"Replicate create failed with HTTP {response.status_code}: {response.text[:1000].strip()}"
            )
        payload = response.json()
        if not isinstance(payload, dict) or not str(payload.get("id") or "").strip():
            raise ReplicateVideoFallbackError("Replicate create returned no prediction id")
        return payload

    async def status(self, prediction_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.get(
                f"{self.base_url}/predictions/{quote(prediction_id, safe='')}",
                headers=self.headers,
            )
        if response.status_code >= 400:
            raise ReplicateVideoFallbackError(
                f"Replicate status failed with HTTP {response.status_code}: {response.text[:1000].strip()}"
            )
        payload = response.json()
        if not isinstance(payload, dict):
            raise ReplicateVideoFallbackError("Replicate status returned an unexpected response")
        return payload

    async def wait(self, prediction_id: str, *, timeout_seconds: float = 1800.0) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            prediction = await self.status(prediction_id)
            status = str(prediction.get("status") or "").strip().lower()
            if status == "succeeded":
                output = prediction.get("output")
                url = str(output or "").strip() if isinstance(output, str) else ""
                if not url and isinstance(output, list) and output:
                    url = str(output[0] or "").strip()
                if not url:
                    raise ReplicateVideoFallbackError("Replicate prediction succeeded without a media URL")
                return {"prediction": prediction, "url": url}
            if status in {"failed", "canceled", "cancelled"}:
                raise ReplicateVideoFallbackError(
                    f"Replicate prediction {status}: {str(prediction.get('error') or '')[:1000]}"
                )
            if asyncio.get_running_loop().time() >= deadline:
                raise ReplicateVideoFallbackError("Replicate video generation timed out")
            await asyncio.sleep(8)


async def process_replicate_video_fallback(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    *,
    primary_error: Exception,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    if not _enabled(source):
        raise ReplicateVideoFallbackError("Replicate video failover is disabled")
    if not is_retryable_pollo_failure(primary_error):
        raise ReplicateVideoFallbackError("Pollo failure is not eligible for automatic provider failover")

    existing_output = dict(job.get("output") or {})
    fallback = dict(existing_output.get("fallback") or {})
    if fallback.get("attempted"):
        raise ReplicateVideoFallbackError("Video fallback has already been attempted for this job")

    input_payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = input_payload.get("generation_packet") if isinstance(input_payload.get("generation_packet"), dict) else {}
    shot_id = str(input_payload.get("shot_id") or packet.get("shot_id") or "")
    if not shot_id:
        raise ReplicateVideoFallbackError("Video job is missing shot_id")

    reference_id = _reference_asset_id(packet)
    image_url = await _load_reference_url(db, reference_id) if reference_id else None
    client = ReplicateVideoClient(source)

    fallback.update({
        "attempted": True,
        "from_provider": "pollo",
        "to_provider": "replicate",
        "primary_error": f"{type(primary_error).__name__}: {primary_error}"[:1200],
        "started_at": _now(),
    })
    existing_output["fallback"] = fallback
    await db.update_job(str(job["id"]), {"progress": 5, "output": existing_output})

    created = await client.create(
        _prompt(packet),
        seconds=_duration(packet.get("duration_target_seconds")),
        image_url=image_url,
    )
    prediction_id = str(created.get("id") or "")
    existing_output.update({
        "fallback": {**fallback, "prediction_id": prediction_id, "state": "running"},
        "provider_model": client.model,
        "provider_status": str(created.get("status") or "starting"),
        "provider_task_id": prediction_id,
        "input_reference_asset_id": reference_id,
    })
    await db.update_job(str(job["id"]), {"progress": 10, "output": existing_output})

    completed = await client.wait(prediction_id)
    media_url = str(completed["url"])
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True) as http:
        response = await http.get(media_url)
    if response.status_code >= 400 or not response.content:
        raise ReplicateVideoFallbackError(f"Replicate video download failed with HTTP {response.status_code}")

    with tempfile.TemporaryDirectory(prefix="d3vonn-replicate-") as tmp:
        master = Path(tmp) / f"{shot_id}.mp4"
        master.write_bytes(response.content)
        object_path = f"{job['project_id']}/generated/{job['id']}/{shot_id}-replicate.mp4"
        stored = await db.upload_master(master, object_path)

    asset_payload = {
        "project_id": job["project_id"],
        "owner_id": job["owner_id"],
        "asset_type": "video",
        "title": f"{shot_id} — generated fallback",
        "description": "AI Films Replicate fallback shot awaiting TwelveLabs/Jockey canon QA.",
        "storage_path": object_path,
        "source_filename": f"{shot_id}-replicate.mp4",
        "category": "generated",
        "subcategory": "shot",
        "status": "selected",
        "version": 1,
        "tags": ["ai-films", "generated", shot_id, "replicate", "fallback"],
        "metadata": {
            "source_type": "generated",
            "provider": "replicate",
            "fallback_from": "pollo",
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
        **existing_output,
        **stored,
        "provider_task_id": prediction_id,
        "provider_model": client.model,
        "provider_status": "completed",
        "provider_media_url": media_url,
        "generated_asset_id": asset_id,
        "shot_id": shot_id,
        "qa": {"state": "pending_generated_qa"},
        "fallback": {
            **fallback,
            "prediction_id": prediction_id,
            "state": "completed",
            "completed_at": _now(),
        },
    }
    await db._request(
        "PATCH",
        "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}"},
        payload={
            "provider": "replicate",
            "status": "completed",
            "progress": 100,
            "completed_at": _now(),
            "updated_at": _now(),
            "error_message": None,
            "output": output,
        },
    )
    return output
