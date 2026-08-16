from __future__ import annotations

import asyncio
import hashlib
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from backend.ai_films.artifact_store import AI_FILM_BUCKET
from backend.ai_films.canary import _provider_guard, _restore_provider_env, make_synthetic_clip
from backend.ai_films.hermes_mastering_bridge import MASTERING_AGENT
from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import create_task, get_task

CANARY_SLUG = "system-mastering-canary"
CANARY_TIMEOUT_SECONDS = int(os.getenv("AI_FILMS_CANARY_TIMEOUT_SECONDS", "900"))
POLL_SECONDS = max(2.0, float(os.getenv("AI_FILMS_CANARY_POLL_SECONDS", "5")))


class ProductionCanaryError(RuntimeError):
    pass


class SupabaseCanaryClient:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.url or not self.key:
            raise ProductionCanaryError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0))

    @property
    def headers(self) -> dict[str, str]:
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}"}

    async def close(self) -> None:
        await self.client.aclose()

    async def rows(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = await self.client.get(
            f"{self.url}/rest/v1/{table}",
            headers={**self.headers, "Accept": "application/json"},
            params=params,
        )
        if response.status_code >= 400:
            raise ProductionCanaryError(f"{table} read failed: HTTP {response.status_code}")
        payload = response.json()
        return payload if isinstance(payload, list) else []

    async def create(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.client.post(
            f"{self.url}/rest/v1/{table}",
            headers={**self.headers, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload,
        )
        if response.status_code not in {200, 201}:
            raise ProductionCanaryError(f"{table} create failed: HTTP {response.status_code}")
        rows = response.json()
        if not isinstance(rows, list) or not rows:
            raise ProductionCanaryError(f"{table} create returned no row")
        return rows[0]

    async def patch(self, table: str, row_id: str, payload: dict[str, Any]) -> None:
        response = await self.client.patch(
            f"{self.url}/rest/v1/{table}",
            headers={**self.headers, "Content-Type": "application/json"},
            params={"id": f"eq.{row_id}"},
            json=payload,
        )
        if response.status_code >= 400:
            raise ProductionCanaryError(f"{table} update failed: HTTP {response.status_code}")

    async def delete_row(self, table: str, row_id: str) -> None:
        response = await self.client.delete(
            f"{self.url}/rest/v1/{table}",
            headers=self.headers,
            params={"id": f"eq.{row_id}"},
        )
        if response.status_code >= 400:
            raise ProductionCanaryError(f"{table} cleanup failed: HTTP {response.status_code}")

    async def upload(self, local_path: Path, object_path: str, content_type: str) -> None:
        encoded = quote(object_path, safe="/")
        response = await self.client.post(
            f"{self.url}/storage/v1/object/{AI_FILM_BUCKET}/{encoded}",
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            content=local_path.read_bytes(),
        )
        if response.status_code not in {200, 201}:
            raise ProductionCanaryError(f"source upload failed: HTTP {response.status_code}")

    async def remove_objects(self, paths: list[str]) -> None:
        if not paths:
            return
        response = await self.client.request(
            "DELETE",
            f"{self.url}/storage/v1/object/{AI_FILM_BUCKET}",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"prefixes": paths},
        )
        if response.status_code >= 400:
            raise ProductionCanaryError(f"storage cleanup failed: HTTP {response.status_code}")


async def _resolve_canary_project(db: SupabaseCanaryClient) -> dict[str, Any]:
    rows = await db.rows(
        "ai_film_projects",
        {"slug": f"eq.{CANARY_SLUG}", "select": "id,owner_id,slug,metadata", "limit": "2"},
    )
    if len(rows) != 1:
        raise ProductionCanaryError(f"expected exactly one {CANARY_SLUG!r} project, found {len(rows)}")
    project = rows[0]
    metadata = project.get("metadata") if isinstance(project.get("metadata"), dict) else {}
    if metadata.get("system_canary") is not True or metadata.get("zero_provider_credit") is not True:
        raise ProductionCanaryError("refusing to run against a project without system_canary/zero_provider_credit tags")
    return project


async def _wait_for_terminal(
    db: SupabaseCanaryClient,
    *,
    render_job_id: str,
    hermes_task_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    deadline = time.monotonic() + CANARY_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        jobs = await db.rows(
            "ai_film_render_jobs",
            {"id": f"eq.{render_job_id}", "select": "*", "limit": "1"},
        )
        job = jobs[0] if jobs else {}
        output = job.get("output") if isinstance(job.get("output"), dict) else {}
        qa = output.get("qa") if isinstance(output.get("qa"), dict) else {}
        state = str(qa.get("state") or "")
        handoff = str(qa.get("hermes_handoff_state") or "")
        task = await get_task(hermes_task_id) or {}
        task_status = str(task.get("status") or "")
        if state == "master_qa_failed":
            raise ProductionCanaryError(f"master QC failed: {json.dumps(qa, sort_keys=True)[:1500]}")
        if str(job.get("status") or "") == "failed":
            raise ProductionCanaryError(f"mastering job failed: {str(job.get('error_message') or '')[:1500]}")
        if state == "master_qa_passed" and handoff == "completed" and task_status == "COMPLETED":
            return job, task
        await asyncio.sleep(POLL_SECONDS)
    raise ProductionCanaryError("production mastering canary timed out")


async def run() -> dict[str, Any]:
    previous = _provider_guard()
    db = SupabaseCanaryClient()
    source_asset_id: str | None = None
    source_object_path: str | None = None
    try:
        project = await _resolve_canary_project(db)
        project_id = str(project["id"])
        owner_id = str(project["owner_id"])
        run_id = uuid.uuid4().hex
        shot_id = f"system-canary-{run_id[:12]}"
        correlation_id = f"ai-films-production-canary:{run_id}"

        with tempfile.TemporaryDirectory(prefix="ai-films-prod-canary-") as tmp:
            source = make_synthetic_clip(Path(tmp) / "source.mp4", duration_seconds=0.5)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            source_object_path = f"{owner_id}/{project_id}/canary/{run_id}/source.mp4"
            await db.upload(source, source_object_path, "video/mp4")

            source_asset = await db.create(
                "ai_film_assets",
                {
                    "project_id": project_id,
                    "owner_id": owner_id,
                    "asset_type": "video",
                    "title": f"System mastering canary source {run_id[:12]}",
                    "description": "Disposable synthetic Rec.709 source for zero-provider-credit production mastering certification.",
                    "storage_path": source_object_path,
                    "source_filename": "source.mp4",
                    "category": "canary",
                    "subcategory": "production_mastering_source",
                    "status": "draft",
                    "tags": ["system-canary", "zero-provider-credit", "synthetic-source"],
                    "metadata": {
                        "system_canary": True,
                        "zero_provider_credit": True,
                        "canary_run_id": run_id,
                        "storage_bucket": AI_FILM_BUCKET,
                        "storage_object_path": source_object_path,
                        "color_space": "Rec.709",
                    },
                    "checksum": digest,
                },
            )
            source_asset_id = str(source_asset["id"])

        task = await create_task(
            title=f"AI FILMS production mastering canary {run_id[:12]}",
            task_type="ai-films-production-canary",
            description="Zero-provider-credit synthetic mastering/QC/Hermes certification.",
            agent_name=MASTERING_AGENT,
            input_data={
                "project_id": project_id,
                "shot_id": shot_id,
                "source_asset_id": source_asset_id,
                "start_timecode": "01:00:00:00",
                "canary_run_id": run_id,
            },
            priority=10,
            source="production-canary",
            correlation_id=correlation_id,
        )
        task_id = str(task["id"])
        dispatcher = get_dependencies().dispatcher
        dispatch = await dispatcher.dispatch(
            task_id=task_id,
            agent_name=MASTERING_AGENT,
            input_data={
                "project_id": project_id,
                "shot_id": shot_id,
                "source_asset_id": source_asset_id,
                "start_timecode": "01:00:00:00",
            },
            idempotency_key=correlation_id,
        )
        render_job_id = str(dispatch.get("render_job_id") or "")
        if not render_job_id:
            raise ProductionCanaryError("Hermes mastering dispatcher returned no render job id")

        job, terminal_task = await _wait_for_terminal(
            db,
            render_job_id=render_job_id,
            hermes_task_id=task_id,
        )
        output = job.get("output") if isinstance(job.get("output"), dict) else {}
        master_asset_id = str(output.get("master_package_asset_id") or "")
        if not master_asset_id:
            raise ProductionCanaryError("passed canary has no master_package_asset_id")
        masters = await db.rows(
            "ai_film_assets",
            {"id": f"eq.{master_asset_id}", "project_id": f"eq.{project_id}", "select": "id,status,metadata", "limit": "1"},
        )
        if not masters or masters[0].get("status") != "approved":
            raise ProductionCanaryError("master package did not reach approved technical state")
        master_metadata = dict(masters[0].get("metadata") or {})
        master_metadata.update({"system_canary": True, "zero_provider_credit": True, "canary_run_id": run_id})
        await db.patch("ai_film_assets", master_asset_id, {"metadata": master_metadata})

        summary = {
            "ok": True,
            "run_id": run_id,
            "project_id": project_id,
            "hermes_task_id": task_id,
            "render_job_id": render_job_id,
            "master_package_asset_id": master_asset_id,
            "frame_count": output.get("frame_count"),
            "qa_state": (output.get("qa") or {}).get("state"),
            "hermes_status": terminal_task.get("status"),
            "provider_spend": 0,
        }
        print(json.dumps(summary, sort_keys=True))
        return summary
    finally:
        # The source is disposable. The certified master package/job/task are retained as audit evidence
        # and tagged system_canary so later canary runs can prune them safely without touching creative data.
        if source_object_path:
            await db.remove_objects([source_object_path])
        if source_asset_id:
            await db.delete_row("ai_film_assets", source_asset_id)
        await db.close()
        _restore_provider_env(previous)


if __name__ == "__main__":
    asyncio.run(run())
