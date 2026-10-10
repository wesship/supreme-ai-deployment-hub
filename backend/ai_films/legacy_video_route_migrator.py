"""Continuously migrate legacy queued OpenAI/Sora render jobs to Pollo.

This compatibility worker prevents older routes that still persist
``provider=openai`` from stranding jobs after Sora is removed from production.
Only queued video jobs are relabeled; in-flight, completed, failed, blocked, and
cancelled records are never rewritten.
"""
from __future__ import annotations

import asyncio
import os
from typing import Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_LEGACY_SORA_MIGRATION_ENABLED", "true")).strip().lower() not in {
        "0", "false", "no", "off"
    }


async def migrate_legacy_video_jobs_once(db: SupabaseAssemblyClient) -> int:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "eq.openai",
            "status": "eq.queued",
            "select": "id,output",
            "order": "created_at.asc",
            "limit": "50",
        },
    )
    migrated = 0
    for row in rows:
        output = dict(row.get("output") or {})
        route_meta = dict(output.get("provider_migration") or {})
        route_meta.update({
            "from": "openai",
            "to": "pollo",
            "reason": "sora_retired_from_d3vonn_production",
            "migrated_at": _now(),
        })
        output["provider_migration"] = route_meta
        updated = await db._request(
            "PATCH",
            "ai_film_render_jobs",
            params={
                "id": f"eq.{row['id']}",
                "provider": "eq.openai",
                "status": "eq.queued",
            },
            payload={"provider": "pollo", "output": output, "updated_at": _now()},
            representation=True,
        )
        if updated:
            migrated += 1
    return migrated


async def run_legacy_video_route_migrator(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_LEGACY_SORA_MIGRATION_POLL_SECONDS", "10") or 10))
    while True:
        await migrate_legacy_video_jobs_once(db)
        if once:
            return
        await asyncio.sleep(poll)
