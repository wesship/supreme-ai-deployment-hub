"""One-render production certification canary for Replicate general video.

This script is intentionally invoked only by the protected manual GitHub Actions
workflow. It creates exactly one short render job, calls the same first-class
Replicate worker function used by production, and verifies that the durable
result is a private AI Films asset queued for generated-shot QA.
"""
from __future__ import annotations

import asyncio
import os
import uuid

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.replicate_video_worker import process_replicate_video_job


CONFIRMATION = "RUN_REPLICATE_VIDEO_CANARY"


def _required(name: str) -> str:
    value = str(os.environ.get(name, "")).strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


async def run() -> None:
    if str(os.environ.get("AI_FILMS_REPLICATE_VIDEO_CANARY_CONFIRMATION", "")) != CONFIRMATION:
        raise RuntimeError("explicit Replicate video canary confirmation is required")

    project_id = _required("AI_FILMS_REPLICATE_VIDEO_CANARY_PROJECT_ID")
    db = SupabaseAssemblyClient(os.environ)
    projects = await db._request(
        "GET",
        "ai_film_projects",
        params={"id": f"eq.{project_id}", "select": "id,owner_id,title", "limit": "1"},
    )
    if not projects:
        raise RuntimeError("bounded canary project was not found")
    project = projects[0]
    owner_id = str(project.get("owner_id") or "").strip()
    if not owner_id:
        raise RuntimeError("bounded canary project has no owner")

    shot_id = f"REPLICATE-CANARY-{uuid.uuid4().hex[:8]}"
    packet = {
        "schema": "d3vonn.ai-films.generation-packet/v1",
        "shot_id": shot_id,
        "generation_prompt": (
            "Five-second cinematic test shot of a neutral geometric light sculpture in a dark studio, "
            "slow controlled camera push, no people, no logos, no text."
        ),
        "negative_prompt": "faces, people, brands, readable text, flashing lights",
        "duration_target_seconds": 5,
        "continuity_locks": [],
        "character_locks": {},
        "anchor_frame_asset_ids": [],
        "visual_intelligence": {
            "style_id": "cinematic-storyboard",
            "source": "d3vonn",
            "compiler": "d3vonn.visual_intelligence.v1",
        },
    }
    rows = await db._request(
        "POST",
        "ai_film_render_jobs",
        payload={
            "project_id": project_id,
            "owner_id": owner_id,
            "job_type": "video",
            "provider": "replicate",
            "status": "processing",
            "priority": 1,
            "progress": 2,
            "attempt_count": 1,
            "started_at": _now(),
            "updated_at": _now(),
            "input": {
                "shot_id": shot_id,
                "generation_packet": packet,
                "canary": "replicate-general-video-v1",
            },
            "output": {},
            "visual_context": {
                "original_prompt": packet["generation_prompt"],
                "compiled_prompt": packet["generation_prompt"],
                "negative_prompt": packet["negative_prompt"],
                "style_id": "cinematic-storyboard",
                "style_source": "d3vonn",
                "compiler": "d3vonn.visual_intelligence.v1",
            },
            "cost_metadata": {},
            "quality_metadata": {},
            "source_subsystem": "ai_films_canary",
            "regeneration_count": 0,
        },
        representation=True,
    )
    if not rows:
        raise RuntimeError("Replicate video canary job could not be created")
    job = rows[0]

    output = await process_replicate_video_job(job, db, os.environ)
    asset_id = str(output.get("generated_asset_id") or "").strip()
    if not asset_id:
        raise RuntimeError("Replicate canary completed without a generated asset id")

    jobs = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "id": f"eq.{job['id']}",
            "select": "id,status,provider,result_asset_id,result_storage_path,cost_metadata,output",
            "limit": "1",
        },
    )
    if not jobs:
        raise RuntimeError("Replicate canary render ledger row disappeared")
    final = jobs[0]
    if str(final.get("status")) != "completed" or str(final.get("provider")) != "replicate":
        raise RuntimeError("Replicate canary did not reach completed provider state")
    if str(final.get("result_asset_id") or "") != asset_id:
        raise RuntimeError("Replicate canary result asset linkage is inconsistent")
    storage_path = str(final.get("result_storage_path") or "")
    if not storage_path.startswith(f"{project_id}/generated/"):
        raise RuntimeError("Replicate canary result is not stored under the private project path")
    final_output = final.get("output") if isinstance(final.get("output"), dict) else {}
    qa = final_output.get("qa") if isinstance(final_output.get("qa"), dict) else {}
    if qa.get("state") != "pending_generated_qa":
        raise RuntimeError("Replicate canary result did not enter generated-shot QA")

    print(f"REPLICATE_VIDEO_CANARY_PASS job_id={job['id']} asset_id={asset_id}")


if __name__ == "__main__":
    asyncio.run(run())
