"""TwelveLabs/Jockey QA for generated character performance-transfer assets."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Mapping

from backend.ai_films.assembly_qa_worker import _sign_master
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.ingestion import TwelveLabsIngestionRunner
from backend.ai_films.manifest_conform_review import _extract_json, _response_text
from backend.ai_films.twelvelabs import TwelveLabsClient
from backend.ai_films.twelvelabs_analyze import TwelveLabsAnalyzeClient

ANALYZE_PROMPT = (
    "Evaluate this performance-transfer clip for character identity preservation, face/head/body motion fidelity, "
    "wardrobe continuity, body proportions, temporal stability, camera preservation, visual artifacts, and any "
    "identity drift. Describe only what is visible and flag uncertainty."
)

JOCKEY_INSTRUCTIONS = (
    "You are D3VONN.IO AI Films character-performance QA. The Production Bible and approved target-character "
    "references are authoritative. Return JSON only. Score identity, motion fidelity, wardrobe continuity, and "
    "temporal stability from 0 to 1. A pass requires no canon violation and all required thresholds to be met."
)


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_PERFORMANCE_QA_ENABLED", "true")).strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _score(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number))


def _decision_with_thresholds(
    parsed: Mapping[str, Any], source: Mapping[str, str]
) -> tuple[str, dict[str, float]]:
    scores = {
        "identity": _score(parsed.get("identity_score")),
        "motion_fidelity": _score(parsed.get("motion_fidelity_score")),
        "wardrobe_continuity": _score(parsed.get("wardrobe_continuity_score")),
        "temporal_stability": _score(parsed.get("temporal_stability_score")),
    }
    identity_min = float(source.get("AI_FILM_PERFORMANCE_IDENTITY_PASS_SCORE", "0.85") or 0.85)
    motion_min = float(source.get("AI_FILM_PERFORMANCE_MOTION_PASS_SCORE", "0.80") or 0.80)
    wardrobe_min = float(source.get("AI_FILM_PERFORMANCE_WARDROBE_PASS_SCORE", "0.80") or 0.80)
    temporal_min = float(source.get("AI_FILM_PERFORMANCE_TEMPORAL_PASS_SCORE", "0.80") or 0.80)
    requested = str(parsed.get("decision") or "revise").lower()
    if requested == "block":
        return "block", scores
    thresholds_met = (
        scores["identity"] >= identity_min
        and scores["motion_fidelity"] >= motion_min
        and scores["wardrobe_continuity"] >= wardrobe_min
        and scores["temporal_stability"] >= temporal_min
    )
    return ("pass" if requested == "pass" and thresholds_met else "revise"), scores


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.performance_transfer",
            "status": "eq.completed",
            "output->qa->>state": "eq.pending_performance_qa",
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
        params={"id": f"eq.{job['id']}", "output->qa->>state": "eq.pending_performance_qa"},
        payload={"output": output, "updated_at": _now()},
        representation=True,
    )
    return claimed[0] if claimed else None


async def _load_bible_and_project(
    db: SupabaseAssemblyClient, project_id: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    bibles = await db._request(
        "GET",
        "ai_film_production_bibles",
        params={
            "project_id": f"eq.{project_id}",
            "status": "eq.active",
            "select": "*",
            "order": "version.desc",
            "limit": "1",
        },
    )
    projects = await db._request(
        "GET", "ai_film_projects", params={"id": f"eq.{project_id}", "select": "metadata", "limit": "1"}
    )
    if not bibles:
        raise RuntimeError("Active Production Bible is missing for performance QA")
    return dict(bibles[0].get("bible") or {}), dict((projects[0].get("metadata") if projects else {}) or {})


def _character_entry(bible: Mapping[str, Any], target_character_id: str) -> dict[str, Any]:
    characters = bible.get("characters") if isinstance(bible.get("characters"), list) else []
    for character in characters:
        if not isinstance(character, dict):
            continue
        candidates = {
            str(character.get("character_id") or ""),
            str(character.get("id") or ""),
            str(character.get("name") or ""),
        }
        if target_character_id in candidates:
            return dict(character)
    return {"character_id": target_character_id}


async def _queue_regeneration(
    db: SupabaseAssemblyClient,
    job: Mapping[str, Any],
    source: Mapping[str, str],
) -> str | None:
    enabled = str(source.get("AI_FILM_PERFORMANCE_AUTO_RETRY_ENABLED", "false")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not enabled:
        return None
    max_generations = max(1, int(source.get("AI_FILM_PERFORMANCE_MAX_GENERATIONS", "2") or 2))
    input_payload = dict(job.get("input") or {})
    metadata = dict(input_payload.get("metadata") or {})
    current_generation = max(1, int(metadata.get("performance_generation") or 1))
    if current_generation >= max_generations:
        return None
    metadata["performance_generation"] = current_generation + 1
    metadata["regenerated_from_job_id"] = str(job.get("id") or "")
    input_payload["metadata"] = metadata
    payload = {
        "project_id": job["project_id"],
        "owner_id": job["owner_id"],
        "job_type": "performance_transfer",
        "provider": job.get("provider") or "replicate",
        "status": "queued",
        "priority": int(job.get("priority") or 25) + 1,
        "progress": 0,
        "attempt_count": 0,
        "input": input_payload,
        "output": {},
    }
    rows = await db._request("POST", "ai_film_render_jobs", payload=payload, representation=True)
    return str(rows[0]["id"]) if rows else None


async def qa_performance_transfer(
    job: Mapping[str, Any],
    db: SupabaseAssemblyClient,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    output = dict(job.get("output") or {})
    input_payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    target_character_id = str(
        output.get("target_character_id") or input_payload.get("target_character_id") or ""
    )
    asset_id = str(output.get("generated_asset_id") or "")
    object_path = str(output.get("object_path") or "")
    project_id = str(job.get("project_id") or "")
    if not project_id or not target_character_id or not asset_id or not object_path:
        raise RuntimeError("Performance QA is missing project, character, asset, or storage identifiers")

    bible, project_meta = await _load_bible_and_project(db, project_id)
    store_id = str(project_meta.get("jockey_store_id") or "").strip()
    if store_id:
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id

    signed_url = await _sign_master(db, object_path)
    client = TwelveLabsClient()
    runner = TwelveLabsIngestionRunner(client)
    created = await runner._create_asset(
        url=signed_url,
        filename=f"performance-{target_character_id}.mp4",
        user_metadata={
            "d3vonn_project_id": project_id,
            "target_character_id": target_character_id,
            "ai_film_asset_id": asset_id,
            "asset_role": "performance_transfer",
        },
    )
    tl_asset_id = str(created.get("_id") or created.get("id") or "")
    if not tl_asset_id:
        raise RuntimeError("TwelveLabs performance asset creation returned no id")
    await runner._wait_for_asset(tl_asset_id, timeout_seconds=900.0, poll_interval_seconds=5.0)

    analyzed = await TwelveLabsAnalyzeClient().analyze_asset(
        tl_asset_id, ANALYZE_PROMPT, model_name="pegasus1.5", temperature=0.1, max_tokens=4096
    )
    analyze_text = _response_text(analyzed)
    item = await runner._create_item(
        tl_asset_id,
        metadata={
            "d3vonn_project_id": project_id,
            "target_character_id": target_character_id,
            "ai_film_asset_id": asset_id,
            "asset_role": "performance_transfer",
        },
    )
    tl_item_id = str(item.get("_id") or item.get("id") or "")
    if not tl_item_id:
        raise RuntimeError("TwelveLabs performance knowledge-store item returned no id")
    await runner._wait_for_item(tl_item_id, timeout_seconds=1200.0, poll_interval_seconds=5.0)

    reason_payload = {
        "task": "Character identity and performance-transfer acceptance review.",
        "target_character_id": target_character_id,
        "target_character": _character_entry(bible, target_character_id),
        "motion_transfer": input_payload.get("motion_transfer", {}),
        "continuity": input_payload.get("continuity", {}),
        "reference_asset_ids": input_payload.get("reference_asset_ids", []),
        "driving_video_asset_id": input_payload.get("driving_video_asset_id"),
        "production_bible": {
            "version": bible.get("version"),
            "canon_rules": bible.get("canon_rules", []),
        },
        "twelvelabs_analyze": analyze_text,
        "required_output": {
            "decision": "pass|revise|block",
            "identity_score": "number 0..1",
            "motion_fidelity_score": "number 0..1",
            "wardrobe_continuity_score": "number 0..1",
            "temporal_stability_score": "number 0..1",
            "reasons": ["string"],
            "canon_violations": ["string"],
            "revision_guidance": "string|null",
        },
    }
    jockey = await client.reason(
        json.dumps(reason_payload, separators=(",", ":")), instructions=JOCKEY_INSTRUCTIONS
    )
    text = _response_text(jockey)
    parsed = _extract_json(text) or {}
    decision, scores = _decision_with_thresholds(parsed, source)
    regenerated_job_id = None
    if decision == "revise":
        regenerated_job_id = await _queue_regeneration(db, job, source)

    qa = {
        "state": "passed" if decision == "pass" else "regenerating" if regenerated_job_id else decision,
        "decision": decision,
        "completed_at": _now(),
        "scores": scores,
        "twelvelabs_asset_id": tl_asset_id,
        "twelvelabs_item_id": tl_item_id,
        "analyze_status": "completed",
        "analyze_assessment": analyze_text,
        "jockey_status": "completed",
        "jockey_response_id": jockey.get("id") or jockey.get("_id"),
        "jockey_review": parsed if parsed else {"raw": text[:12000]},
        "regenerated_job_id": regenerated_job_id,
    }
    output["qa"] = qa
    await db.update_job(str(job["id"]), {"output": output})

    asset_rows = await db._request(
        "GET", "ai_film_assets", params={"id": f"eq.{asset_id}", "select": "metadata", "limit": "1"}
    )
    if asset_rows:
        metadata = dict(asset_rows[0].get("metadata") or {})
        metadata.update(
            {
                "qa_state": qa["state"],
                "identity_score": scores["identity"],
                "motion_fidelity_score": scores["motion_fidelity"],
                "wardrobe_continuity_score": scores["wardrobe_continuity"],
                "temporal_stability_score": scores["temporal_stability"],
                "twelvelabs_asset_id": tl_asset_id,
                "twelvelabs_item_id": tl_item_id,
                "jockey_response_id": qa["jockey_response_id"],
                "regenerated_job_id": regenerated_job_id,
            }
        )
        await db._request(
            "PATCH",
            "ai_film_assets",
            params={"id": f"eq.{asset_id}"},
            payload={
                "metadata": metadata,
                "status": "approved" if decision == "pass" else "selected",
                "updated_at": _now(),
            },
        )
    return qa


async def run_performance_transfer_qa_worker(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    runtime_environment = str(
        source.get("RAILWAY_ENVIRONMENT_NAME") or source.get("ENVIRONMENT") or ""
    ).strip().lower()
    if runtime_environment != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_PERFORMANCE_QA_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await qa_performance_transfer(job, db, source)
        except Exception as exc:
            output = dict(job.get("output") or {})
            qa = dict(output.get("qa") or {})
            qa.update(
                {
                    "state": "failed",
                    "failed_at": _now(),
                    "error": f"{type(exc).__name__}: {exc}"[:2000],
                    "retryable": True,
                }
            )
            output["qa"] = qa
            await db.update_job(str(job["id"]), {"output": output})
        if once:
            return
