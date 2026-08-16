"""Railway-native AI FILMS mastering worker.

Consumes queued `mastering/ffmpeg` render jobs, resolves an owner-scoped durable
source asset, decodes it through the camera/ACEScg/OpenEXR editorial pipeline,
persists the generated master package in private Supabase Storage, and records
one durable package asset plus deterministic job output.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote, urlparse

import httpx

from backend.ai_films.artifact_store import SupabaseArtifactStore
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.frame_sequence import decode_to_acescg_exr_sequence

logger = logging.getLogger(__name__)


class MasteringWorkerError(RuntimeError):
    """Raised when a queued mastering job cannot be completed safely."""


async def _claim_next_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.mastering",
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
    claimed = await db._request(
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


async def _load_scoped_source_asset(
    db: SupabaseAssemblyClient,
    *,
    asset_id: str,
    project_id: str,
    owner_id: str,
) -> dict[str, Any]:
    rows = await db._request(
        "GET",
        "ai_film_assets",
        params={
            "id": f"eq.{asset_id}",
            "project_id": f"eq.{project_id}",
            "owner_id": f"eq.{owner_id}",
            "select": "id,project_id,owner_id,asset_type,source_filename,storage_path,metadata,status",
            "limit": "1",
        },
    )
    if not rows:
        raise MasteringWorkerError(
            "Source asset is unavailable or does not belong to the mastering job owner/project"
        )
    return rows[0]


async def _sign_storage_object(
    db: SupabaseAssemblyClient,
    *,
    bucket: str,
    object_path: str,
    expires_in: int = 900,
) -> str:
    encoded_bucket = quote(bucket, safe="")
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    headers = {
        "apikey": db.service_key,
        "Authorization": f"Bearer {db.service_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        response = await client.post(
            f"{db.base_url}/storage/v1/object/sign/{encoded_bucket}/{encoded_path}",
            headers=headers,
            json={"expiresIn": expires_in},
        )
    if response.status_code >= 400:
        raise MasteringWorkerError(
            f"Could not sign source storage object: HTTP {response.status_code}"
        )
    payload = response.json()
    signed = payload.get("signedURL") or payload.get("signedUrl")
    if not isinstance(signed, str) or not signed:
        raise MasteringWorkerError("Supabase Storage returned no signed source URL")
    if signed.startswith("http"):
        return signed
    return f"{db.base_url}/storage/v1{signed if signed.startswith('/') else '/' + signed}"


async def _source_url(db: SupabaseAssemblyClient, asset: Mapping[str, Any]) -> str:
    metadata = asset.get("metadata") if isinstance(asset.get("metadata"), dict) else {}
    bucket = str(metadata.get("storage_bucket") or "").strip()
    object_path = str(metadata.get("storage_object_path") or "").strip()
    if bucket and object_path:
        return await _sign_storage_object(db, bucket=bucket, object_path=object_path)

    storage_path = str(asset.get("storage_path") or "").strip()
    parsed = urlparse(storage_path)
    if parsed.scheme in {"https", "http"} and parsed.netloc:
        return storage_path

    raise MasteringWorkerError(
        "Source asset does not expose a server-readable durable storage location"
    )


async def _download_source(url: str, destination: Path) -> None:
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=15.0),
            follow_redirects=True,
        ) as client:
            async with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    raise MasteringWorkerError(
                        f"Source media download failed with HTTP {response.status_code}"
                    )
                with destination.open("wb") as handle:
                    async for chunk in response.aiter_bytes():
                        handle.write(chunk)
    except httpx.HTTPError as exc:
        raise MasteringWorkerError("Source media could not be downloaded") from exc
    if not destination.is_file() or destination.stat().st_size == 0:
        raise MasteringWorkerError("Source media downloaded as an empty file")


async def process_mastering_job(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    *,
    artifact_store: SupabaseArtifactStore | None = None,
) -> dict[str, Any]:
    job_id = str(job.get("id") or "")
    project_id = str(job.get("project_id") or "")
    owner_id = str(job.get("owner_id") or "")
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    source_asset_id = str(payload.get("source_asset_id") or "").strip()
    shot_id = str(payload.get("shot_id") or "").strip()
    start_timecode = str(payload.get("start_timecode") or "").strip() or None
    if not job_id or not project_id or not owner_id:
        raise MasteringWorkerError("Mastering job is missing persisted ownership identifiers")
    if not source_asset_id or not shot_id:
        raise MasteringWorkerError("Mastering job requires source_asset_id and shot_id")

    source_asset = await _load_scoped_source_asset(
        db,
        asset_id=source_asset_id,
        project_id=project_id,
        owner_id=owner_id,
    )
    source_url = await _source_url(db, source_asset)
    source_filename = str(source_asset.get("source_filename") or "source.mov")
    suffix = Path(source_filename).suffix or ".mov"

    await db.update_job(job_id, {"progress": 8})
    store = artifact_store or SupabaseArtifactStore.from_env()
    owns_store = artifact_store is None
    try:
        with tempfile.TemporaryDirectory(prefix="d3vonn-mastering-") as tmp:
            root = Path(tmp)
            source_path = root / f"source{suffix}"
            frames_dir = root / "master"
            await _download_source(source_url, source_path)
            await db.update_job(job_id, {"progress": 18})

            manifest = await asyncio.to_thread(
                decode_to_acescg_exr_sequence,
                source_path,
                frames_dir,
                start_timecode=start_timecode,
            )
            await db.update_job(job_id, {"progress": 78})
            package = await store.persist_frame_sequence_package(
                project_id=project_id,
                shot_id=shot_id,
                manifest=manifest,
                owner_id=owner_id,
            )
    finally:
        if owns_store:
            await store.aclose()

    output = {
        "source_asset_id": source_asset_id,
        "shot_id": shot_id,
        "master_package_asset_id": package.asset_id,
        "package_prefix": package.package_prefix,
        "storage_path": package.storage_path,
        "frame_paths": list(package.frame_paths),
        "frame_count": manifest.frame_count,
        "frame_rate": manifest.frame_rate,
        "width": manifest.width,
        "height": manifest.height,
        "source_color_space": manifest.source_color_space,
        "editorial_manifest_path": package.editorial_manifest_path,
        "otio_timeline_path": package.otio_timeline_path,
        "checksum": package.checksum,
        "qa": {"state": "pending_master_qa"},
    }
    await db.update_job(
        job_id,
        {
            "status": "completed",
            "progress": 100,
            "completed_at": _now(),
            "error_message": None,
            "output": output,
        },
    )
    return output


async def run_mastering_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        logger.info("AI FILMS mastering worker skipped outside production Railway.")
        return
    if str(source.get("AI_FILM_MASTERING_WORKER_ENABLED", "true")).strip().lower() in {
        "0",
        "false",
        "no",
        "off",
    }:
        logger.info("AI FILMS mastering worker disabled by environment.")
        return

    db = SupabaseAssemblyClient(source)
    poll = max(2.0, float(source.get("AI_FILM_MASTERING_POLL_SECONDS", "8") or 8))
    while True:
        job = await _claim_next_job(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        job_id = str(job.get("id") or "")
        try:
            await process_mastering_job(job, db)
            logger.info("AI FILMS mastering completed for job %s", job_id)
        except Exception as exc:
            logger.exception("AI FILMS mastering failed for job %s", job_id)
            await db.update_job(
                job_id,
                {
                    "status": "failed",
                    "progress": 0,
                    "completed_at": _now(),
                    "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                },
            )
        if once:
            return
