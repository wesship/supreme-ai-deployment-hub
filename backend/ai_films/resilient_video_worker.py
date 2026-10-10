"""Certified AI Films video worker with Pollo primary and Replicate support."""
from __future__ import annotations

import asyncio
import os
from typing import Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.pollo_video_worker import _claim, _enabled, process_pollo_video_job
from backend.ai_films.provider_activation import activation_status
from backend.ai_films.replicate_video_fallback import (
    is_retryable_pollo_failure,
    process_replicate_video_fallback,
)
from backend.ai_films.replicate_video_worker import (
    _claim_replicate,
    process_replicate_video_job,
)


async def run_resilient_video_worker(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return

    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_VIDEO_WORKER_POLL_SECONDS", "15") or 15))
    while True:
        provider = "pollo"
        job = await _claim(db)
        if not job and activation_status("replicate", source).executable:
            provider = "replicate"
            job = await _claim_replicate(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue

        if provider == "replicate":
            try:
                await process_replicate_video_job(job, db, source)
            except Exception as exc:
                await db.update_job(
                    str(job["id"]),
                    {
                        "status": "failed",
                        "error_message": f"{type(exc).__name__}: {exc}"[:2000],
                        "completed_at": _now(),
                        "updated_at": _now(),
                    },
                )
            if once:
                return
            continue

        try:
            await process_pollo_video_job(job, db, source)
        except Exception as primary_exc:
            if is_retryable_pollo_failure(primary_exc):
                try:
                    await process_replicate_video_fallback(
                        job,
                        db,
                        primary_error=primary_exc,
                        environ=source,
                    )
                except Exception as fallback_exc:
                    await db.update_job(
                        str(job["id"]),
                        {
                            "status": "failed",
                            "error_message": (
                                f"Primary Pollo failure: {type(primary_exc).__name__}: {primary_exc}; "
                                f"Replicate fallback failure: {type(fallback_exc).__name__}: {fallback_exc}"
                            )[:2000],
                            "completed_at": _now(),
                            "updated_at": _now(),
                        },
                    )
            else:
                await db.update_job(
                    str(job["id"]),
                    {
                        "status": "failed",
                        "error_message": f"{type(primary_exc).__name__}: {primary_exc}"[:2000],
                        "completed_at": _now(),
                        "updated_at": _now(),
                    },
                )
        if once:
            return
