"""Retry-safe handoff from terminal master QC into Hermes workflow tasks."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.hermes_mastering_bridge import finalize_hermes_mastering_task

logger = logging.getLogger(__name__)


async def _next_handoff_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.mastering",
            "provider": "eq.ffmpeg",
            "status": "eq.completed",
            "input->>hermes_task_id": "not.is.null",
            "select": "*",
            "order": "completed_at.asc",
            "limit": "25",
        },
    )
    for job in rows:
        output = job.get("output") if isinstance(job.get("output"), dict) else {}
        qa = output.get("qa") if isinstance(output.get("qa"), dict) else {}
        if qa.get("state") not in {"master_qa_passed", "master_qa_failed"}:
            continue
        if qa.get("hermes_handoff_state") == "completed":
            continue
        return job
    return None


async def process_handoff_job(job: Mapping[str, Any], db: SupabaseAssemblyClient) -> bool:
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    state = str(qa.get("state") or "")
    if state not in {"master_qa_passed", "master_qa_failed"}:
        return False

    qa["hermes_handoff_state"] = "in_progress"
    qa["hermes_handoff_started_at"] = _now()
    output["qa"] = qa
    await db.update_job(str(job.get("id") or ""), {"output": output})

    certification = qa.get("certification") if isinstance(qa.get("certification"), dict) else {}
    try:
        handed_off = await finalize_hermes_mastering_task(
            dict(job),
            passed=state == "master_qa_passed",
            certification=certification,
        )
    except Exception as exc:
        qa["hermes_handoff_state"] = "retry"
        qa["hermes_handoff_error"] = f"{type(exc).__name__}: {exc}"[:2000]
        qa["hermes_handoff_updated_at"] = _now()
        output["qa"] = qa
        await db.update_job(str(job.get("id") or ""), {"output": output})
        raise

    qa["hermes_handoff_state"] = "completed" if handed_off else "not_bound"
    qa["hermes_handoff_error"] = None
    qa["hermes_handoff_updated_at"] = _now()
    output["qa"] = qa
    await db.update_job(str(job.get("id") or ""), {"output": output})
    return handed_off


async def run_hermes_mastering_handoff_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        logger.info("AI FILMS Hermes mastering handoff skipped outside production Railway.")
        return
    if str(source.get("AI_FILM_HERMES_HANDOFF_WORKER_ENABLED", "true")).strip().lower() in {
        "0",
        "false",
        "no",
        "off",
    }:
        logger.info("AI FILMS Hermes mastering handoff worker disabled by environment.")
        return

    db = SupabaseAssemblyClient(source)
    poll = max(2.0, float(source.get("AI_FILM_HERMES_HANDOFF_POLL_SECONDS", "8") or 8))
    while True:
        job = await _next_handoff_job(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await process_handoff_job(job, db)
            logger.info("AI FILMS Hermes handoff completed for render job %s", job.get("id"))
        except Exception:
            logger.exception("AI FILMS Hermes handoff failed for render job %s", job.get("id"))
        if once:
            return
