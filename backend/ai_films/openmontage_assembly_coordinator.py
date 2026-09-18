"""OpenMontage multishot-to-assembly coordinator.

Waits until every Pollo/Replicate segment in an OpenMontage group has passed
TwelveLabs/Jockey generated-shot QA, then queues exactly one FFmpeg assembly job.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_OPENMONTAGE_ASSEMBLY_ENABLED", "true")).strip().lower() not in {
        "0", "false", "no", "off"
    }


def _group_id(job: Mapping[str, Any]) -> str:
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    return str(payload.get("openmontage_job_id") or "").strip()


def _qa_state(job: Mapping[str, Any]) -> str:
    output = job.get("output") if isinstance(job.get("output"), dict) else {}
    qa = output.get("qa") if isinstance(output.get("qa"), dict) else {}
    return str(qa.get("state") or "").strip().lower()


def _assembly_input(jobs: list[Mapping[str, Any]]) -> dict[str, Any]:
    ordered = sorted(
        jobs,
        key=lambda row: int((row.get("input") or {}).get("openmontage_shot_index") or 0),
    )
    first_input = ordered[0].get("input") if isinstance(ordered[0].get("input"), dict) else {}
    group_id = str(first_input.get("openmontage_job_id") or "")
    timeline: list[dict[str, Any]] = []
    for row in ordered:
        payload = row.get("input") if isinstance(row.get("input"), dict) else {}
        packet = payload.get("generation_packet") if isinstance(payload.get("generation_packet"), dict) else {}
        output = row.get("output") if isinstance(row.get("output"), dict) else {}
        duration = float(packet.get("duration_target_seconds") or 5)
        timeline.append(
            {
                "asset_id": str(output.get("generated_asset_id") or ""),
                "label": str(payload.get("shot_id") or packet.get("shot_id") or row.get("id") or "shot"),
                "source_in": 0,
                "source_out": duration,
                "duration": duration,
                "transition_in": "cut",
                "transition_out": "cut",
            }
        )
    return {
        "openmontage_job_id": group_id,
        "title": f"openmontage-{group_id}",
        "structure": "montage",
        "timeline": timeline,
        "target_runtime_seconds": float(first_input.get("openmontage_target_duration_seconds") or sum(i["duration"] for i in timeline)),
        "planned_runtime_seconds": sum(i["duration"] for i in timeline),
        "fps": 30,
        "resolution": str(first_input.get("openmontage_resolution") or "1920x1080"),
        "aspect_ratio": str(first_input.get("openmontage_aspect_ratio") or "16:9"),
        "audio_tracks": [],
        "subtitle_cues": [],
        "qa": {
            "continuity": True,
            "final_twelvelabs_analyze": True,
            "jockey_corpus_reasoning": True,
        },
        "source_render_job_ids": [str(row.get("id") or "") for row in ordered],
    }


async def _next_ready_group(db: SupabaseAssemblyClient) -> list[dict[str, Any]] | None:
    page_size = 50
    offset = 0
    while offset < 1000:
        candidates = await db._request(
            "GET",
            "ai_film_render_jobs",
            params={
                "job_type": "eq.video",
                "provider": "in.(pollo,replicate)",
                "status": "eq.completed",
                "select": "*",
                "order": "completed_at.asc",
                "limit": str(page_size),
                "offset": str(offset),
            },
        )
        if not candidates:
            return None
        for candidate in candidates:
            group_id = _group_id(candidate)
            if not group_id or _qa_state(candidate) != "passed":
                continue
            project_id = str(candidate.get("project_id") or "")
            project_jobs = await db._request(
                "GET",
                "ai_film_render_jobs",
                params={
                    "project_id": f"eq.{project_id}",
                    "job_type": "eq.video",
                    "select": "*",
                    "order": "created_at.asc",
                    "limit": "20",
                },
            )
            group = [row for row in project_jobs if _group_id(row) == group_id]
            expected = max(
                [int((row.get("input") or {}).get("openmontage_shot_count") or 1) for row in group] or [1]
            )
            if expected <= 1 or len(group) != expected:
                continue
            if any(str(row.get("status") or "") != "completed" or _qa_state(row) != "passed" for row in group):
                continue
            if any(not str((row.get("output") or {}).get("generated_asset_id") or "") for row in group):
                continue

            assemblies = await db._request(
                "GET",
                "ai_film_render_jobs",
                params={
                    "project_id": f"eq.{project_id}",
                    "job_type": "eq.assembly",
                    "select": "id,input,status",
                    "limit": "20",
                },
            )
            if any(str((row.get("input") or {}).get("openmontage_job_id") or "") == group_id for row in assemblies):
                continue
            return group
        if len(candidates) < page_size:
            return None
        offset += page_size
    return None


async def _queue_assembly(db: SupabaseAssemblyClient, jobs: list[Mapping[str, Any]]) -> dict[str, Any]:
    first = jobs[0]
    payload = _assembly_input(list(jobs))
    rows = await db._request(
        "POST",
        "ai_film_render_jobs",
        payload={
            "project_id": first["project_id"],
            "scene_id": first.get("scene_id"),
            "owner_id": first["owner_id"],
            "job_type": "assembly",
            "provider": "ffmpeg",
            "status": "queued",
            "priority": 90,
            "progress": 0,
            "input": payload,
            "output": {
                "openmontage": {
                    "job_id": payload["openmontage_job_id"],
                    "source_render_job_ids": payload["source_render_job_ids"],
                    "state": "queued_for_assembly",
                }
            },
            "created_at": _now(),
            "updated_at": _now(),
        },
        representation=True,
    )
    if not rows:
        raise RuntimeError("OpenMontage assembly insert returned no job")
    return rows[0]


async def run_openmontage_assembly_coordinator(
    *,
    environ: Mapping[str, str] | None = None,
    once: bool = False,
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return

    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_OPENMONTAGE_ASSEMBLY_POLL_SECONDS", "15") or 15))
    while True:
        group = await _next_ready_group(db)
        if group:
            job = await _queue_assembly(db, group)
            print(
                f"[openmontage] assembly_queued job={job['id']} group={_group_id(group[0])}",
                flush=True,
            )
        elif once:
            return
        if once:
            return
        await asyncio.sleep(poll)
