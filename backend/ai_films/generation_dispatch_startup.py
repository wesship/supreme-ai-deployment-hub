"""Production startup planner for multimodel AI Films generation gaps.

The planner never spends credits by default. It persists the route chosen from
Railway's real provider configuration. Render jobs are created only when
AI_FILM_GENERATION_EXECUTION_ENABLED=true.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient
from backend.ai_films.generation_dispatcher import dispatch_plan
from backend.ai_films.production_bible import ProductionBible, ShotManifest

PROJECT_ID = "b2979e7c-1d28-4024-bf4f-8db90c174d5a"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enabled(source: Mapping[str, str], key: str, default: str = "false") -> bool:
    return str(source.get(key, default)).strip().lower() in {"1", "true", "yes", "on"}


def _review_decisions(metadata: Mapping[str, Any]) -> dict[str, str]:
    review = metadata.get("conform_review")
    if not isinstance(review, dict):
        return {}
    shots = review.get("shots")
    if not isinstance(shots, list):
        return {}
    out: dict[str, str] = {}
    for item in shots:
        if isinstance(item, dict) and item.get("shot_id") and item.get("decision"):
            out[str(item["shot_id"])] = str(item["decision"])
    return out


async def plan_generation_on_startup(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        return {"status": "skipped", "reason": "not_production"}
    if not _enabled(source, "AI_FILM_GENERATION_DISPATCH_ENABLED", "true"):
        return {"status": "skipped", "reason": "disabled"}

    db = SupabaseAssemblyClient(source)
    manifests = await db._request(
        "GET", "ai_film_shot_manifests",
        params={"project_id": f"eq.{PROJECT_ID}", "status": "eq.active", "select": "*", "order": "manifest_version.desc", "limit": "1"},
    )
    bibles = await db._request(
        "GET", "ai_film_production_bibles",
        params={"project_id": f"eq.{PROJECT_ID}", "status": "eq.active", "select": "*", "order": "version.desc", "limit": "1"},
    )
    if not manifests or not bibles:
        return {"status": "skipped", "reason": "missing_active_bible_or_manifest"}

    row = manifests[0]
    manifest_data = dict(row.get("manifest") or {})
    metadata = dict(manifest_data.get("metadata") or {})
    decisions = _review_decisions(metadata)
    if not decisions:
        return {"status": "skipped", "reason": "jockey_review_not_ready"}

    bible = ProductionBible.model_validate(bibles[0].get("bible") or {})
    manifest = ShotManifest.model_validate(manifest_data)
    plans: dict[str, Any] = {}
    for shot in manifest.shots:
        plans[shot.shot_id] = dispatch_plan(
            shot, bible,
            conform_decision=decisions.get(shot.shot_id, "manual_review"),
            environ=source,
        )

    execution_enabled = _enabled(source, "AI_FILM_GENERATION_EXECUTION_ENABLED", "false")
    queued_job_ids: list[str] = []
    if execution_enabled:
        existing = await db._request(
            "GET", "ai_film_render_jobs",
            params={"project_id": f"eq.{PROJECT_ID}", "job_type": "eq.video", "select": "id,status,input"},
        )
        existing_shots = {
            str((job.get("input") or {}).get("shot_id"))
            for job in existing
            if isinstance(job.get("input"), dict) and str(job.get("status")) in {"queued", "running", "processing", "completed", "succeeded"}
        }
        for shot_id, plan in plans.items():
            if plan.get("action") != "queue" or shot_id in existing_shots:
                continue
            payload = {
                "project_id": PROJECT_ID,
                "owner_id": row.get("owner_id"),
                "job_type": "video",
                "provider": plan.get("selected_provider"),
                "status": "queued",
                "priority": 20,
                "progress": 0,
                "input": {
                    "shot_id": shot_id,
                    "generation_packet": plan.get("generation_packet"),
                    "selected_model": plan.get("selected_model"),
                    "dispatcher": "multimodel-v1",
                },
                "output": {},
            }
            created = await db._request("POST", "ai_film_render_jobs", payload=payload, representation=True)
            if created:
                queued_job_ids.append(str(created[0].get("id")))

    metadata.update({
        "generation_dispatch_state": "completed",
        "generation_dispatch_completed_at": _now(),
        "generation_execution_enabled": execution_enabled,
        "generation_dispatch_plans": plans,
        "generation_queued_job_ids": queued_job_ids,
    })
    manifest_data["metadata"] = metadata
    await db._request(
        "PATCH", "ai_film_shot_manifests",
        params={"id": f"eq.{row['id']}"},
        payload={"manifest": manifest_data, "updated_at": _now()},
    )
    return {
        "status": "completed",
        "execution_enabled": execution_enabled,
        "generate_shots": [sid for sid, p in plans.items() if p.get("action") in {"queue", "blocked"}],
        "queued_job_ids": queued_job_ids,
    }
