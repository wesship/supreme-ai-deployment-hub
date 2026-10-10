"""Generated-shot TwelveLabs/Jockey QA worker for certified video providers."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.generated_shot_qa_worker import qa_generated_shot


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_GENERATED_SHOT_QA_ENABLED", "true")).strip().lower() not in {
        "0", "false", "no", "off"
    }


def _stale_cutoff(source: Mapping[str, str]) -> str:
    stale_seconds = max(
        3600.0,
        float(source.get("AI_FILM_GENERATED_SHOT_QA_STALE_SECONDS", "3600") or 3600),
    )
    return (datetime.now(timezone.utc) - timedelta(seconds=stale_seconds)).isoformat()


async def _claim_pending(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "in.(pollo,replicate)",
            "status": "eq.completed",
            "output->qa->>state": "eq.pending_generated_qa",
            "select": "*",
            "order": "completed_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    qa.update({"state": "in_progress", "started_at": _now()})
    output["qa"] = qa
    claimed = await db._request(
        "PATCH",
        "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "output->qa->>state": "eq.pending_generated_qa"},
        payload={"output": output, "updated_at": _now()},
        representation=True,
    )
    return claimed[0] if claimed else None


async def _claim_stale(
    db: SupabaseAssemblyClient,
    source: Mapping[str, str],
) -> dict[str, Any] | None:
    cutoff = _stale_cutoff(source)
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "in.(pollo,replicate)",
            "status": "eq.completed",
            "output->qa->>state": "eq.in_progress",
            "updated_at": f"lt.{cutoff}",
            "select": "*",
            "order": "updated_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    recovered_at = _now()
    qa.update(
        {
            "state": "in_progress",
            "started_at": recovered_at,
            "recovered_at": recovered_at,
            "recovery_count": int(qa.get("recovery_count") or 0) + 1,
            "recovery_reason": "stale_worker_claim",
        }
    )
    output["qa"] = qa
    claimed = await db._request(
        "PATCH",
        "ai_film_render_jobs",
        params={
            "id": f"eq.{job['id']}",
            "output->qa->>state": "eq.in_progress",
            "updated_at": f"lt.{cutoff}",
        },
        payload={"output": output, "updated_at": recovered_at},
        representation=True,
    )
    return claimed[0] if claimed else None


async def _claim(
    db: SupabaseAssemblyClient,
    source: Mapping[str, str],
) -> dict[str, Any] | None:
    return await _claim_pending(db) or await _claim_stale(db, source)


async def _latest_output(db: SupabaseAssemblyClient, job_id: str, fallback: Mapping[str, Any]) -> dict[str, Any]:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={"id": f"eq.{job_id}", "select": "output", "limit": "1"},
    )
    if rows:
        return dict(rows[0].get("output") or {})
    return dict(fallback.get("output") or {})


async def run_pollo_generated_shot_qa_worker(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_GENERATED_SHOT_QA_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim(db, source)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await qa_generated_shot(job, db)
        except Exception as exc:
            output = await _latest_output(db, str(job["id"]), job)
            qa = dict(output.get("qa") or {})
            qa.update({
                "state": "failed",
                "failed_at": _now(),
                "error": f"{type(exc).__name__}: {exc}"[:2000],
                "retryable": True,
            })
            output["qa"] = qa
            await db.update_job(str(job["id"]), {"output": output})
            print(f"[ai-films-qa] job={job['id']} failed={type(exc).__name__}: {exc}", flush=True)
        if once:
            return
