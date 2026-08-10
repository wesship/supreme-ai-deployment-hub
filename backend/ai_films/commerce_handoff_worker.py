"""Durable Pollo result retrieval and TwelveLabs/Jockey commerce handoff.

Pollo completion webhooks intentionally contain only ``taskId`` and ``status``.
This worker claims successful commerce jobs, retrieves the authoritative task
result, materializes each generated video in the configured TwelveLabs
knowledge store, and records restart-safe progress on the commerce job.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping
from urllib.parse import quote, urlsplit

import httpx

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.ingestion import TwelveLabsIngestionRunner
from backend.ai_films.twelvelabs import TwelveLabsClient

logger = logging.getLogger(__name__)


class CommerceHandoffError(RuntimeError):
    """Raised when a terminal commerce handoff step fails."""


class CommerceHandoffPending(CommerceHandoffError):
    """Raised when Pollo has not published a downloadable result yet."""


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_COMMERCE_HANDOFF_ENABLED", "true")).strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


async def fetch_pollo_result(
    task_id: str,
    environ: Mapping[str, str] | None = None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    """Retrieve the authoritative Pollo task result without exposing the key."""
    source = environ or os.environ
    api_key = str(source.get("POLLO_API_KEY", "")).strip()
    if not api_key:
        raise CommerceHandoffError("POLLO_API_KEY is not configured")
    base_url = str(
        source.get("POLLO_API_BASE_URL", "https://pollo.ai/api/platform")
    ).strip().rstrip("/")
    if not base_url:
        raise CommerceHandoffError("POLLO_API_BASE_URL is not configured")

    safe_task_id = quote(task_id.strip(), safe="")
    if not safe_task_id:
        raise CommerceHandoffError("Pollo task id is required")
    try:
        async with httpx.AsyncClient(
            headers={"x-api-key": api_key, "Accept": "application/json"},
            timeout=httpx.Timeout(45.0, connect=10.0),
            transport=transport,
        ) as client:
            response = await client.get(
                f"{base_url}/generation/{safe_task_id}/status"
            )
    except httpx.HTTPError as exc:
        raise CommerceHandoffError("Pollo task status could not be retrieved") from exc
    if response.status_code >= 400:
        raise CommerceHandoffError(
            f"Pollo task status failed with HTTP {response.status_code}"
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise CommerceHandoffError("Pollo returned invalid task status JSON") from exc
    if not isinstance(payload, dict):
        raise CommerceHandoffError("Pollo returned an unexpected task status response")
    result = payload.get("data", payload)
    if not isinstance(result, dict):
        raise CommerceHandoffError("Pollo task status data is missing")
    return result


def _task_generations(payload: Mapping[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    raw_generations = payload.get("generations")
    if not isinstance(raw_generations, list) or not raw_generations:
        raise CommerceHandoffError("Pollo task status returned no generations")
    generations = [dict(item) for item in raw_generations if isinstance(item, dict)]
    if not generations:
        raise CommerceHandoffError("Pollo task generations are invalid")

    statuses = {str(item.get("status") or "").strip().lower() for item in generations}
    if statuses & {"waiting", "processing", "queued", "submitted"}:
        raise CommerceHandoffPending("Pollo task result is not downloadable yet")
    if statuses & {"failed", "failure", "error", "cancel", "canceled", "cancelled"}:
        raise CommerceHandoffError("Pollo task contains a failed generation")

    urls: list[str] = []
    for item in generations:
        url = str(item.get("url") or "").strip()
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise CommerceHandoffError("Pollo generation returned an invalid media URL")
        if url not in urls:
            urls.append(url)
    if not urls:
        raise CommerceHandoffError("Pollo task returned no downloadable media URL")
    return generations, urls


async def _patch_job(
    db: SupabaseAssemblyClient,
    job_id: str,
    payload: Mapping[str, Any],
) -> None:
    updates = dict(payload)
    updates["updated_at"] = _now()
    await db._request(
        "PATCH",
        "ai_film_commerce_jobs",
        params={"id": f"eq.{job_id}"},
        payload=updates,
    )


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_commerce_jobs",
        params={
            "status": "in.(succeeded,completed)",
            "handoff_status": "eq.queued",
            "select": "*",
            "order": "completed_at.asc,created_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    handoff = dict(job.get("handoff_payload") or {})
    handoff.update({"state": "processing", "claimed_at": _now()})
    claimed = await db._request(
        "PATCH",
        "ai_film_commerce_jobs",
        params={"id": f"eq.{job['id']}", "handoff_status": "eq.queued"},
        payload={
            "handoff_status": "processing",
            "handoff_payload": handoff,
            "error_message": None,
            "updated_at": _now(),
        },
        representation=True,
    )
    return claimed[0] if claimed else None


async def _requeue_stale_claims(
    db: SupabaseAssemblyClient,
    *,
    stale_after_seconds: float,
) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_seconds)
    rows = await db._request(
        "GET",
        "ai_film_commerce_jobs",
        params={
            "handoff_status": "eq.processing",
            "updated_at": f"lt.{cutoff.isoformat()}",
            "select": "id,handoff_payload",
            "limit": "20",
        },
    )
    for row in rows:
        handoff = dict(row.get("handoff_payload") or {})
        handoff.update(
            {
                "state": "queued",
                "recovered_at": _now(),
                "retryable": True,
            }
        )
        await db._request(
            "PATCH",
            "ai_film_commerce_jobs",
            params={
                "id": f"eq.{row['id']}",
                "handoff_status": "eq.processing",
            },
            payload={
                "handoff_status": "queued",
                "handoff_payload": handoff,
                "updated_at": _now(),
            },
        )


def _compact_result(result: Mapping[str, Any]) -> dict[str, str]:
    return {
        "source_id": str(result.get("source_id") or ""),
        "status": str(result.get("status") or "queued"),
        "twelvelabs_asset_id": str(result.get("twelvelabs_asset_id") or ""),
        "twelvelabs_item_id": str(result.get("twelvelabs_item_id") or ""),
    }


async def process_commerce_handoff(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    job_id = str(job.get("id") or "").strip()
    task_id = str(job.get("task_id") or "").strip()
    if not job_id or not task_id:
        raise CommerceHandoffError("Commerce handoff is missing job or task id")

    task = await fetch_pollo_result(task_id, source)
    generations, media_urls = _task_generations(task)
    output = dict(job.get("output") or {})
    output.update(
        {
            "provider_task": task,
            "generations": generations,
            "media_urls": media_urls,
        }
    )
    handoff = dict(job.get("handoff_payload") or {})
    existing_results = [
        dict(item)
        for item in handoff.get("results", [])
        if isinstance(item, dict)
    ]
    completed_sources = {
        str(item.get("source_id") or "") for item in existing_results
    }
    handoff.update(
        {
            "state": "processing",
            "task_id": task_id,
            "media_urls": media_urls,
            "targets": ["twelvelabs", "jockey"],
            "results": existing_results,
        }
    )
    await _patch_job(
        db,
        job_id,
        {"output": output, "handoff_payload": handoff},
    )

    client = TwelveLabsClient(source)
    runner = TwelveLabsIngestionRunner(client)
    results = list(existing_results)
    for index, media_url in enumerate(media_urls, start=1):
        source_id = f"{task_id}:{index}"
        if source_id in completed_sources:
            continue
        ingested = await runner.ingest_entry(
            {
                "batch_id": f"pollo-{task_id}",
                "project_id": "",
                "ai_film_asset_id": job_id,
                "source_type": "pollo_commerce",
                "source_id": source_id,
                "source_filename": f"pollo-{task_id}-{index}.mp4",
                "ingestion_method": "url",
                "media_url": media_url,
            },
            wait_for_item=False,
        )
        compact = _compact_result(ingested)
        results.append(compact)
        completed_sources.add(source_id)
        handoff["results"] = results
        handoff["last_progress_at"] = _now()
        await _patch_job(db, job_id, {"handoff_payload": handoff})

    handoff.update(
        {
            "state": "completed",
            "completed_at": _now(),
            "knowledge_store_id": client.knowledge_store_id,
            "results": results,
            "retryable": False,
        }
    )
    await _patch_job(
        db,
        job_id,
        {
            "handoff_status": "completed",
            "handoff_payload": handoff,
            "output": output,
            "error_message": None,
        },
    )
    return handoff


async def run_commerce_handoff_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        logger.info("AI Films commerce handoff worker skipped outside production Railway.")
        return
    if not _enabled(source):
        logger.info("AI Films commerce handoff worker is disabled.")
        return

    db = SupabaseAssemblyClient(source)
    poll_seconds = max(
        5.0,
        float(source.get("AI_FILM_COMMERCE_HANDOFF_POLL_SECONDS", "15") or 15),
    )
    stale_seconds = max(
        300.0,
        float(source.get("AI_FILM_COMMERCE_HANDOFF_STALE_SECONDS", "1800") or 1800),
    )
    await _requeue_stale_claims(db, stale_after_seconds=stale_seconds)

    while True:
        job = await _claim(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll_seconds)
            continue
        job_id = str(job.get("id") or "")
        try:
            await process_commerce_handoff(job, db, source)
            logger.info("AI Films Pollo handoff completed for job %s", job_id)
        except CommerceHandoffPending as exc:
            handoff = dict(job.get("handoff_payload") or {})
            handoff.update(
                {
                    "state": "queued",
                    "last_checked_at": _now(),
                    "retryable": True,
                    "detail": str(exc),
                }
            )
            await _patch_job(
                db,
                job_id,
                {
                    "handoff_status": "queued",
                    "handoff_payload": handoff,
                    "error_message": None,
                },
            )
            if not once:
                await asyncio.sleep(poll_seconds)
        except Exception as exc:
            logger.exception("AI Films Pollo handoff failed for job %s", job_id)
            handoff = dict(job.get("handoff_payload") or {})
            handoff.update(
                {
                    "state": "failed",
                    "failed_at": _now(),
                    "retryable": True,
                    "error": f"{type(exc).__name__}: {exc}"[:2000],
                }
            )
            await _patch_job(
                db,
                job_id,
                {
                    "handoff_status": "failed",
                    "handoff_payload": handoff,
                    "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                },
            )
        if once:
            return

