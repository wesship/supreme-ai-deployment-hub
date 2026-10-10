"""Replicate execution worker for AI Films performance-transfer jobs.

The worker is deliberately provider-scoped and opt-in. It consumes only
``performance_transfer/replicate`` jobs, resolves private AI Films assets to
short-lived signed URLs, executes the configured Replicate model, stores the
result privately, registers a generated asset, and hands the result to the
performance QA worker.
"""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

import httpx

from backend.ai_films.assembly_qa_worker import _sign_master
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now


class PerformanceTransferWorkerError(RuntimeError):
    pass


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_PERFORMANCE_EXECUTION_ENABLED", "false")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _input_map(source: Mapping[str, str]) -> dict[str, str]:
    raw = str(source.get("AI_FILM_REPLICATE_PERFORMANCE_INPUT_MAP_JSON", "")).strip()
    if not raw:
        return {
            "driving_video_url": "driving_video",
            "reference_image_url": "reference_image",
        }
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise PerformanceTransferWorkerError(
            "AI_FILM_REPLICATE_PERFORMANCE_INPUT_MAP_JSON is invalid JSON"
        ) from exc
    if not isinstance(parsed, dict) or not all(
        isinstance(key, str) and isinstance(value, str) and key and value
        for key, value in parsed.items()
    ):
        raise PerformanceTransferWorkerError(
            "AI_FILM_REPLICATE_PERFORMANCE_INPUT_MAP_JSON must be an object of canonical-to-provider field names"
        )
    return dict(parsed)


def _canonical_inputs(
    *,
    driving_video_url: str,
    reference_image_urls: list[str],
    target_character_id: str,
    motion_transfer: Mapping[str, Any],
    continuity: Mapping[str, Any],
) -> dict[str, Any]:
    return {
        "driving_video_url": driving_video_url,
        "reference_image_url": reference_image_urls[0],
        "reference_image_urls": reference_image_urls,
        "target_character_id": target_character_id,
        "transfer_face_motion": bool(motion_transfer.get("face", True)),
        "transfer_head_motion": bool(motion_transfer.get("head", True)),
        "transfer_body_motion": bool(motion_transfer.get("body", True)),
        "preserve_body_motion": bool(continuity.get("preserve_body_motion", True)),
        "preserve_camera": bool(continuity.get("preserve_camera", True)),
        "preserve_wardrobe": bool(continuity.get("preserve_wardrobe", True)),
    }


def _build_provider_input(
    *,
    driving_video_url: str,
    reference_image_urls: list[str],
    target_character_id: str,
    motion_transfer: Mapping[str, Any],
    continuity: Mapping[str, Any],
    metadata: Mapping[str, Any],
    environ: Mapping[str, str],
) -> dict[str, Any]:
    canonical = _canonical_inputs(
        driving_video_url=driving_video_url,
        reference_image_urls=reference_image_urls,
        target_character_id=target_character_id,
        motion_transfer=motion_transfer,
        continuity=continuity,
    )
    mapped: dict[str, Any] = {}
    for canonical_name, provider_name in _input_map(environ).items():
        if canonical_name in canonical:
            mapped[provider_name] = canonical[canonical_name]
    overrides = metadata.get("provider_input") if isinstance(metadata.get("provider_input"), dict) else {}
    for key, value in overrides.items():
        if isinstance(key, str) and key:
            mapped[key] = value
    if not mapped:
        raise PerformanceTransferWorkerError("Replicate performance input mapping produced an empty payload")
    return mapped


async def _signed_asset_url(
    db: SupabaseAssemblyClient,
    asset_id: str,
    *,
    expected_type: str | None = None,
) -> str:
    rows = await db._request(
        "GET",
        "ai_film_assets",
        params={"id": f"eq.{asset_id}", "select": "id,asset_type,status,metadata", "limit": "1"},
    )
    if not rows:
        raise PerformanceTransferWorkerError(f"AI Films asset {asset_id} was not found")
    row = rows[0]
    if expected_type and str(row.get("asset_type") or "") != expected_type:
        raise PerformanceTransferWorkerError(
            f"AI Films asset {asset_id} must be asset_type={expected_type}"
        )
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    object_path = str(metadata.get("storage_object_path") or "").strip()
    if not object_path:
        raise PerformanceTransferWorkerError(
            f"AI Films asset {asset_id} has no private storage object path"
        )
    return await _sign_master(db, object_path, expires_in=1800)


def _output_url(value: Any) -> str | None:
    if isinstance(value, str) and value.startswith(("https://", "http://")):
        return value
    if isinstance(value, list):
        for item in value:
            found = _output_url(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("url", "video", "output", "file"):
            found = _output_url(value.get(key))
            if found:
                return found
        for item in value.values():
            found = _output_url(item)
            if found:
                return found
    return None


class ReplicatePerformanceClient:
    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        source = environ or os.environ
        self.api_token = str(source.get("REPLICATE_API_TOKEN", "")).strip()
        self.model = str(source.get("AI_FILM_REPLICATE_PERFORMANCE_MODEL", "")).strip()
        self.base_url = str(source.get("REPLICATE_API_BASE_URL", "https://api.replicate.com/v1")).rstrip("/")
        if not self.api_token or not self.model:
            raise PerformanceTransferWorkerError(
                "REPLICATE_API_TOKEN and AI_FILM_REPLICATE_PERFORMANCE_MODEL are required"
            )
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    async def create(self, provider_input: Mapping[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=15.0)) as client:
            response = await client.post(
                f"{self.base_url}/predictions",
                headers={**self.headers, "Prefer": "wait"},
                json={"version": self.model, "input": dict(provider_input)},
            )
        if response.status_code >= 400:
            raise PerformanceTransferWorkerError(
                f"Replicate performance prediction create failed with HTTP {response.status_code}"
            )
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("id"):
            raise PerformanceTransferWorkerError("Replicate performance prediction returned no id")
        return payload

    async def retrieve(self, prediction_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=15.0)) as client:
            response = await client.get(
                f"{self.base_url}/predictions/{prediction_id}", headers=self.headers
            )
        if response.status_code >= 400:
            raise PerformanceTransferWorkerError(
                f"Replicate performance prediction retrieve failed with HTTP {response.status_code}"
            )
        payload = response.json()
        if not isinstance(payload, dict):
            raise PerformanceTransferWorkerError("Replicate performance prediction returned invalid JSON")
        return payload

    async def wait(self, prediction: Mapping[str, Any], *, timeout_seconds: float = 1800.0) -> dict[str, Any]:
        current = dict(prediction)
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            status = str(current.get("status") or "").strip().lower()
            if status in {"succeeded", "successful"}:
                return current
            if status in {"failed", "canceled", "cancelled"}:
                error = str(current.get("error") or status)
                raise PerformanceTransferWorkerError(
                    f"Replicate performance prediction ended with status {status}: {error[:500]}"
                )
            if asyncio.get_running_loop().time() >= deadline:
                raise PerformanceTransferWorkerError("Replicate performance prediction timed out")
            await asyncio.sleep(5)
            current = await self.retrieve(str(current["id"]))


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.performance_transfer",
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


async def process_performance_transfer_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    consent = payload.get("consent") if isinstance(payload.get("consent"), dict) else {}
    if not bool(consent.get("confirmed")):
        raise PerformanceTransferWorkerError("Performance transfer execution requires confirmed consent")

    driving_asset_id = str(payload.get("driving_video_asset_id") or "").strip()
    target_character_id = str(payload.get("target_character_id") or "").strip()
    reference_ids = [str(value) for value in payload.get("reference_asset_ids", []) if str(value).strip()]
    source_asset_id = str(payload.get("source_asset_id") or "").strip()
    if not reference_ids and source_asset_id:
        reference_ids = [source_asset_id]
    if not driving_asset_id or not target_character_id or not reference_ids:
        raise PerformanceTransferWorkerError(
            "Performance transfer job is missing driving video, target character, or identity references"
        )

    driving_url = await _signed_asset_url(db, driving_asset_id, expected_type="video")
    reference_urls = [
        await _signed_asset_url(db, asset_id, expected_type="image") for asset_id in reference_ids
    ]
    motion_transfer = payload.get("motion_transfer") if isinstance(payload.get("motion_transfer"), dict) else {}
    continuity = payload.get("continuity") if isinstance(payload.get("continuity"), dict) else {}
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    provider_input = _build_provider_input(
        driving_video_url=driving_url,
        reference_image_urls=reference_urls,
        target_character_id=target_character_id,
        motion_transfer=motion_transfer,
        continuity=continuity,
        metadata=metadata,
        environ=source,
    )

    client = ReplicatePerformanceClient(source)
    prediction = await client.create(provider_input)
    prediction_id = str(prediction["id"])
    await db.update_job(
        str(job["id"]),
        {
            "progress": 8,
            "output": {
                "provider_job_id": prediction_id,
                "provider_model": client.model,
                "provider_status": prediction.get("status"),
            },
        },
    )
    completed = await client.wait(prediction)
    output_url = _output_url(completed.get("output"))
    if not output_url:
        raise PerformanceTransferWorkerError("Replicate performance prediction returned no downloadable video")
    await db.update_job(str(job["id"]), {"progress": 82})

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True
    ) as http:
        media = await http.get(output_url)
    if media.status_code >= 400 or not media.content:
        raise PerformanceTransferWorkerError(
            f"Replicate performance output download failed with HTTP {media.status_code}"
        )

    with tempfile.TemporaryDirectory(prefix="d3vonn-performance-") as tmp:
        local_path = Path(tmp) / f"{job['id']}.mp4"
        local_path.write_bytes(media.content)
        object_path = f"{job['project_id']}/performance/{job['id']}/{target_character_id}.mp4"
        stored = await db.upload_master(local_path, object_path)

    asset_payload = {
        "project_id": job["project_id"],
        "owner_id": job["owner_id"],
        "asset_type": "video",
        "title": f"{target_character_id} — performance transfer",
        "description": "AI Films performance-transfer result awaiting TwelveLabs/Jockey continuity QA.",
        "storage_path": object_path,
        "source_filename": f"{target_character_id}-performance.mp4",
        "category": "generated",
        "subcategory": "performance_transfer",
        "status": "selected",
        "version": 1,
        "tags": ["ai-films", "performance-transfer", "replicate", target_character_id],
        "metadata": {
            "source_type": "generated",
            "provider": "replicate",
            "provider_prediction_id": prediction_id,
            "provider_model": client.model,
            "render_job_id": str(job["id"]),
            "target_character_id": target_character_id,
            "driving_video_asset_id": driving_asset_id,
            "reference_asset_ids": reference_ids,
            "storage_bucket": db.bucket,
            "storage_object_path": object_path,
            "qa_state": "pending_performance_qa",
        },
        "checksum": stored.get("sha256"),
    }
    assets = await db._request("POST", "ai_film_assets", payload=asset_payload, representation=True)
    generated_asset_id = str(assets[0]["id"]) if assets else ""
    output = {
        **stored,
        "provider_job_id": prediction_id,
        "provider_model": client.model,
        "provider_status": str(completed.get("status") or "succeeded"),
        "generated_asset_id": generated_asset_id,
        "target_character_id": target_character_id,
        "driving_video_asset_id": driving_asset_id,
        "reference_asset_ids": reference_ids,
        "qa": {"state": "pending_performance_qa"},
    }
    await db.update_job(
        str(job["id"]),
        {"status": "completed", "progress": 100, "completed_at": _now(), "output": output},
    )
    return output


async def run_performance_transfer_worker(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_PERFORMANCE_WORKER_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await process_performance_transfer_job(job, db, source)
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
