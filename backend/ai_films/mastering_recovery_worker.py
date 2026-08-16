"""Restart recovery for the AI FILMS mastering/QC/Hermes handoff pipeline."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now

logger = logging.getLogger(__name__)


def _cutoff(seconds: float) -> str:
    age = max(900.0, float(seconds))
    return (datetime.now(timezone.utc) - timedelta(seconds=age)).isoformat()


async def _cas_update(
    db: SupabaseAssemblyClient,
    *,
    job_id: str,
    filters: Mapping[str, str],
    payload: Mapping[str, Any],
) -> bool:
    params = {"id": f"eq.{job_id}", **dict(filters)}
    updates = dict(payload)
    updates["updated_at"] = _now()
    rows = await db._request(
        "PATCH",
        "ai_film_render_jobs",
        params=params,
        payload=updates,
        representation=True,
    )
    return bool(rows)


async def recover_stale_states(
    db: SupabaseAssemblyClient,
    *,
    stale_seconds: float = 7200.0,
    max_mastering_attempts: int = 3,
) -> dict[str, int]:
    """Recover only nonterminal states abandoned by a process restart.

    Every write is compare-and-set against the stale state and cutoff observed by
    the sweep. A live worker that updates the row after the scan therefore wins,
    and recovery leaves it untouched.
    """
    cutoff = _cutoff(stale_seconds)
    counts = {
        "mastering_requeued": 0,
        "mastering_failed": 0,
        "qc_requeued": 0,
        "handoff_retried": 0,
    }

    processing = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.mastering",
            "provider": "eq.ffmpeg",
            "status": "eq.processing",
            "updated_at": f"lt.{cutoff}",
            "select": "*",
            "order": "updated_at.asc",
            "limit": "100",
        },
    )
    for job in processing:
        job_id = str(job.get("id") or "")
        if not job_id:
            continue
        attempts = int(job.get("attempt_count") or 0)
        output = dict(job.get("output") or {})
        recovery = dict(output.get("recovery") or {})
        recovery.update(
            {
                "last_recovered_at": _now(),
                "reason": "stale_mastering_processing",
                "attempt_count": attempts,
            }
        )
        output["recovery"] = recovery
        filters = {
            "status": "eq.processing",
            "updated_at": f"lt.{cutoff}",
        }
        if attempts >= max(1, int(max_mastering_attempts)):
            changed = await _cas_update(
                db,
                job_id=job_id,
                filters=filters,
                payload={
                    "status": "failed",
                    "progress": 0,
                    "completed_at": _now(),
                    "error_message": "Mastering recovery exhausted the configured attempt limit",
                    "output": output,
                },
            )
            counts["mastering_failed"] += int(changed)
        else:
            changed = await _cas_update(
                db,
                job_id=job_id,
                filters=filters,
                payload={
                    "status": "queued",
                    "progress": 0,
                    "started_at": None,
                    "completed_at": None,
                    "error_message": None,
                    "output": output,
                },
            )
            counts["mastering_requeued"] += int(changed)

    stale_completed = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.mastering",
            "provider": "eq.ffmpeg",
            "status": "eq.completed",
            "updated_at": f"lt.{cutoff}",
            "select": "*",
            "order": "updated_at.asc",
            "limit": "100",
        },
    )
    for job in stale_completed:
        job_id = str(job.get("id") or "")
        if not job_id:
            continue
        output = dict(job.get("output") or {})
        qa = dict(output.get("qa") or {})
        qa_state = str(qa.get("state") or "")
        handoff_state = str(qa.get("hermes_handoff_state") or "")

        if qa_state == "master_qa_in_progress":
            qa["state"] = "pending_master_qa"
            qa["recovered_at"] = _now()
            qa["recovery_reason"] = "stale_master_qa_claim"
            output["qa"] = qa
            changed = await _cas_update(
                db,
                job_id=job_id,
                filters={
                    "status": "eq.completed",
                    "updated_at": f"lt.{cutoff}",
                    "output->qa->>state": "eq.master_qa_in_progress",
                },
                payload={"output": output},
            )
            counts["qc_requeued"] += int(changed)
            continue

        if (
            qa_state in {"master_qa_passed", "master_qa_failed"}
            and handoff_state == "in_progress"
        ):
            qa["hermes_handoff_state"] = "retry"
            qa["hermes_handoff_updated_at"] = _now()
            qa["hermes_handoff_error"] = "Recovered stale Hermes handoff claim"
            output["qa"] = qa
            changed = await _cas_update(
                db,
                job_id=job_id,
                filters={
                    "status": "eq.completed",
                    "updated_at": f"lt.{cutoff}",
                    "output->qa->>hermes_handoff_state": "eq.in_progress",
                },
                payload={"output": output},
            )
            counts["handoff_retried"] += int(changed)

    return counts


async def run_mastering_recovery_worker(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        logger.info("AI FILMS mastering recovery skipped outside production Railway.")
        return
    if str(source.get("AI_FILM_MASTERING_RECOVERY_ENABLED", "true")).strip().lower() in {
        "0",
        "false",
        "no",
        "off",
    }:
        logger.info("AI FILMS mastering recovery worker disabled by environment.")
        return

    stale_seconds = max(
        900.0,
        float(source.get("AI_FILM_MASTERING_STALE_SECONDS", "7200") or 7200),
    )
    max_attempts = max(
        1,
        int(source.get("AI_FILM_MASTERING_MAX_ATTEMPTS", "3") or 3),
    )
    poll = max(
        30.0,
        float(source.get("AI_FILM_MASTERING_RECOVERY_POLL_SECONDS", "120") or 120),
    )
    db = SupabaseAssemblyClient(source)

    while True:
        try:
            recovered = await recover_stale_states(
                db,
                stale_seconds=stale_seconds,
                max_mastering_attempts=max_attempts,
            )
            if any(recovered.values()):
                logger.warning("AI FILMS mastering recovery applied: %s", recovered)
        except Exception:
            logger.exception("AI FILMS mastering recovery sweep failed")
        if once:
            return
        await asyncio.sleep(poll)
