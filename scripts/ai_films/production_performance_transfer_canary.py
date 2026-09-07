from __future__ import annotations

import asyncio
import hashlib
import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from backend.ai_films.assembly_worker import SupabaseAssemblyClient
from backend.ai_films.performance_transfer_qa_worker import qa_performance_transfer
from backend.ai_films.performance_transfer_worker import process_performance_transfer_job

MAX_SECONDS = max(1.0, min(8.0, float(os.getenv("AI_FILMS_PERFORMANCE_CANARY_MAX_SECONDS", "4"))))
TARGET_CHARACTER_ID = os.getenv("AI_FILMS_PERFORMANCE_CANARY_CHARACTER_ID", "legend").strip() or "legend"


class PerformanceCanaryError(RuntimeError):
    pass


class CanaryDB(SupabaseAssemblyClient):
    async def upload_source(self, local_path: Path, object_path: str) -> dict[str, Any]:
        data = local_path.read_bytes()
        encoded = quote(object_path, safe="/")
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "video/mp4",
            "x-upsert": "false",
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0)) as client:
            response = await client.post(
                f"{self.base_url}/storage/v1/object/{quote(self.bucket, safe='')}/{encoded}",
                headers=headers,
                content=data,
            )
        if response.status_code not in {200, 201}:
            raise PerformanceCanaryError(f"private source upload failed with HTTP {response.status_code}")
        return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "object_path": object_path}

    async def remove_object(self, object_path: str) -> None:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
            response = await client.request(
                "DELETE",
                f"{self.base_url}/storage/v1/object/{quote(self.bucket, safe='')}",
                headers={
                    "apikey": self.service_key,
                    "Authorization": f"Bearer {self.service_key}",
                    "Content-Type": "application/json",
                },
                json={"prefixes": [object_path]},
            )
        if response.status_code >= 400:
            raise PerformanceCanaryError(f"private source cleanup failed with HTTP {response.status_code}")


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise PerformanceCanaryError(f"{name} is required")
    return value


def _bounded_source(source_path: Path, output_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-t",
            str(MAX_SECONDS),
            "-vf",
            "scale='min(720,iw)':-2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-an",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


async def _download_source(url: str, destination: Path) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0), follow_redirects=True) as client:
        response = await client.get(url)
    if response.status_code >= 400 or not response.content:
        raise PerformanceCanaryError(f"canary source download failed with HTTP {response.status_code}")
    destination.write_bytes(response.content)


async def run() -> dict[str, Any]:
    source_url = _required("AI_FILMS_PERFORMANCE_CANARY_SOURCE_URL")
    project_id = _required("AI_FILMS_PERFORMANCE_CANARY_PROJECT_ID")
    owner_id = _required("AI_FILMS_PERFORMANCE_CANARY_OWNER_ID")
    reference_asset_id = _required("AI_FILMS_PERFORMANCE_CANARY_REFERENCE_ASSET_ID")

    env = dict(os.environ)
    env["AI_FILM_PERFORMANCE_AUTO_RETRY_ENABLED"] = "false"
    env.setdefault("AI_FILM_PERFORMANCE_QA_ENABLED", "true")

    run_id = uuid.uuid4().hex
    db = CanaryDB(env)
    source_asset_id: str | None = None
    source_object_path: str | None = None
    render_job_id: str | None = None

    try:
        refs = await db._request(
            "GET",
            "ai_film_assets",
            params={
                "id": f"eq.{reference_asset_id}",
                "project_id": f"eq.{project_id}",
                "asset_type": "eq.image",
                "select": "id,status,metadata",
                "limit": "1",
            },
        )
        if not refs:
            raise PerformanceCanaryError("reference image asset was not found in the target project")
        ref_meta = refs[0].get("metadata") if isinstance(refs[0].get("metadata"), dict) else {}
        if not ref_meta.get("storage_object_path"):
            raise PerformanceCanaryError("reference image must already be private-stored")

        with tempfile.TemporaryDirectory(prefix="d3vonn-performance-canary-") as tmp:
            raw = Path(tmp) / "source-original.mp4"
            bounded = Path(tmp) / "source-canary.mp4"
            await _download_source(source_url, raw)
            _bounded_source(raw, bounded)

            source_object_path = f"{project_id}/canary/performance/{run_id}/driving.mp4"
            stored = await db.upload_source(bounded, source_object_path)
            rows = await db._request(
                "POST",
                "ai_film_assets",
                payload={
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "asset_type": "video",
                    "title": f"Performance canary driving source {run_id[:12]}",
                    "description": "Disposable bounded source for a single protected performance-transfer certification run.",
                    "storage_path": source_object_path,
                    "source_filename": "performance-canary.mp4",
                    "category": "canary",
                    "subcategory": "performance_transfer_source",
                    "status": "draft",
                    "version": 1,
                    "tags": ["system-canary", "performance-transfer", "disposable-source"],
                    "metadata": {
                        "system_canary": True,
                        "performance_canary": True,
                        "canary_run_id": run_id,
                        "storage_bucket": db.bucket,
                        "storage_object_path": source_object_path,
                        "max_seconds": MAX_SECONDS,
                    },
                    "checksum": stored["sha256"],
                },
                representation=True,
            )
            if not rows:
                raise PerformanceCanaryError("source asset registration returned no row")
            source_asset_id = str(rows[0]["id"])

        jobs = await db._request(
            "POST",
            "ai_film_render_jobs",
            payload={
                "project_id": project_id,
                "owner_id": owner_id,
                "job_type": "performance_transfer",
                "provider": "replicate",
                "status": "processing",
                "priority": 100,
                "progress": 2,
                "attempt_count": 1,
                "input": {
                    "target_character_id": TARGET_CHARACTER_ID,
                    "driving_video_asset_id": source_asset_id,
                    "reference_asset_ids": [reference_asset_id],
                    "motion_transfer": {"face": True, "head": True, "body": True},
                    "continuity": {
                        "preserve_body_motion": True,
                        "preserve_camera": True,
                        "preserve_wardrobe": True,
                    },
                    "consent": {"confirmed": True, "scope": "production-performance-canary"},
                    "metadata": {
                        "system_canary": True,
                        "performance_canary": True,
                        "canary_run_id": run_id,
                        "performance_generation": 1,
                    },
                },
                "output": {},
            },
            representation=True,
        )
        if not jobs:
            raise PerformanceCanaryError("performance canary job registration returned no row")
        job = jobs[0]
        render_job_id = str(job["id"])

        await process_performance_transfer_job(job, db, env)
        refreshed = await db._request(
            "GET",
            "ai_film_render_jobs",
            params={"id": f"eq.{render_job_id}", "select": "*", "limit": "1"},
        )
        if not refreshed:
            raise PerformanceCanaryError("completed performance job could not be reloaded")
        qa = await qa_performance_transfer(refreshed[0], db, env)
        decision = str(qa.get("decision") or "")
        if decision not in {"pass", "revise", "block"}:
            raise PerformanceCanaryError(f"unexpected performance QA decision: {decision!r}")

        output = dict(refreshed[0].get("output") or {})
        summary = {
            "ok": decision == "pass",
            "run_id": run_id,
            "project_id": project_id,
            "render_job_id": render_job_id,
            "generated_asset_id": output.get("generated_asset_id"),
            "target_character_id": TARGET_CHARACTER_ID,
            "max_source_seconds": MAX_SECONDS,
            "decision": decision,
            "scores": qa.get("scores"),
            "auto_retry_enabled": False,
        }
        print(json.dumps(summary, sort_keys=True))
        if decision != "pass":
            raise PerformanceCanaryError(f"performance canary did not pass QA: {decision}")
        return summary
    finally:
        if source_asset_id:
            try:
                await db._request("DELETE", "ai_film_assets", params={"id": f"eq.{source_asset_id}"})
            except Exception:
                pass
        if source_object_path:
            try:
                await db.remove_object(source_object_path)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(run())
