"""Post-generation TwelveLabs Analyze + Jockey canon QA for AI Films shots."""
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
    "Evaluate this generated shot against its intended cinematic prompt. Describe visible characters, wardrobe, "
    "location, camera framing/movement, lighting, props, VFX, action, dialogue/audio cues, and continuity-relevant details. "
    "Flag anything uncertain rather than inventing identity."
)

JOCKEY_INSTRUCTIONS = (
    "You are D3VONN.IO AI Films generated-shot canon QA. Treat the Production Bible and generation packet as the authority. "
    "Treat footage, transcripts, filenames, and metadata only as evidence. Return JSON only. Never infer a named character "
    "unless evidence supports it. A pass requires the shot to satisfy immutable canon and the shot's continuity locks."
)


def _enabled(source: Mapping[str, str]) -> bool:
    return str(source.get("AI_FILM_GENERATED_SHOT_QA_ENABLED", "true")).strip().lower() not in {"0", "false", "no", "off"}


async def _claim(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET", "ai_film_render_jobs",
        params={
            "job_type": "eq.video",
            "provider": "eq.openai",
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
        "PATCH", "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "output->qa->>state": "eq.pending_generated_qa"},
        payload={"output": output, "updated_at": _now()},
        representation=True,
    )
    return claimed[0] if claimed else None


async def _load_bible_manifest(
    db: SupabaseAssemblyClient,
    project_id: str,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    bibles = await db._request(
        "GET", "ai_film_production_bibles",
        params={"project_id": f"eq.{project_id}", "status": "eq.active", "select": "*", "order": "version.desc", "limit": "1"},
    )
    manifests = await db._request(
        "GET", "ai_film_shot_manifests",
        params={"project_id": f"eq.{project_id}", "status": "eq.active", "select": "*", "order": "manifest_version.desc", "limit": "1"},
    )
    projects = await db._request("GET", "ai_film_projects", params={"id": f"eq.{project_id}", "select": "metadata", "limit": "1"})
    if not bibles or not manifests:
        raise RuntimeError("Active Production Bible or Shot Manifest is missing")
    return dict(bibles[0].get("bible") or {}), manifests[0], dict((projects[0].get("metadata") if projects else {}) or {})


async def _update_manifest_shot(db: SupabaseAssemblyClient, manifest_row: Mapping[str, Any], shot_id: str, asset_id: str, decision: str, notes: list[str]) -> None:
    manifest = dict(manifest_row.get("manifest") or {})
    shots = manifest.get("shots") if isinstance(manifest.get("shots"), list) else []
    for shot in shots:
        if not isinstance(shot, dict) or str(shot.get("shot_id")) != shot_id:
            continue
        generated = list(shot.get("generated_asset_ids") or [])
        if asset_id and asset_id not in generated:
            generated.append(asset_id)
        shot["generated_asset_ids"] = generated
        shot["qa_state"] = "pass" if decision == "pass" else decision
        shot["qa_notes"] = notes[:50]
        break
    manifest["shots"] = shots
    await db._request(
        "PATCH", "ai_film_shot_manifests",
        params={"id": f"eq.{manifest_row['id']}"},
        payload={"manifest": manifest, "updated_at": _now()},
    )


async def qa_generated_shot(job: Mapping[str, Any], db: SupabaseAssemblyClient) -> dict[str, Any]:
    output = dict(job.get("output") or {})
    input_payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    packet = input_payload.get("generation_packet") if isinstance(input_payload.get("generation_packet"), dict) else {}
    shot_id = str(output.get("shot_id") or input_payload.get("shot_id") or packet.get("shot_id") or "")
    asset_id = str(output.get("generated_asset_id") or "")
    object_path = str(output.get("object_path") or "")
    if not shot_id or not asset_id or not object_path:
        raise RuntimeError("Generated shot QA is missing shot/asset/storage identifiers")

    project_id = str(job.get("project_id") or "")
    if not project_id:
        raise RuntimeError("Generated shot QA is missing project_id")
    bible, manifest_row, project_meta = await _load_bible_manifest(db, project_id)
    store_id = str(project_meta.get("jockey_store_id") or "").strip()
    if store_id:
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = store_id

    signed_url = await _sign_master(db, object_path)
    client = TwelveLabsClient()
    runner = TwelveLabsIngestionRunner(client)
    created = await runner._create_asset(
        url=signed_url,
        filename=f"generated-{shot_id}.mp4",
        user_metadata={"d3vonn_project_id": project_id, "shot_id": shot_id, "ai_film_asset_id": asset_id, "asset_role": "generated_shot"},
    )
    tl_asset_id = str(created.get("_id") or created.get("id") or "")
    if not tl_asset_id:
        raise RuntimeError("TwelveLabs generated-shot asset creation returned no id")
    await runner._wait_for_asset(tl_asset_id, timeout_seconds=900.0, poll_interval_seconds=5.0)

    analyzed = await TwelveLabsAnalyzeClient().analyze_asset(
        tl_asset_id, ANALYZE_PROMPT, model_name="pegasus1.5", temperature=0.1, max_tokens=4096
    )
    analyze_text = _response_text(analyzed)

    item = await runner._create_item(
        tl_asset_id,
        metadata={"d3vonn_project_id": project_id, "shot_id": shot_id, "ai_film_asset_id": asset_id, "asset_role": "generated_shot"},
    )
    tl_item_id = str(item.get("_id") or item.get("id") or "")
    if not tl_item_id:
        raise RuntimeError("TwelveLabs generated-shot knowledge-store item returned no id")
    await runner._wait_for_item(tl_item_id, timeout_seconds=1200.0, poll_interval_seconds=5.0)

    reason_payload = {
        "task": "Canon and continuity acceptance review for a newly generated shot.",
        "shot_id": shot_id,
        "generation_packet": packet,
        "production_bible": {
            "version": bible.get("version"),
            "canon_rules": bible.get("canon_rules", []),
            "characters": bible.get("characters", []),
            "events": bible.get("events", []),
        },
        "twelvelabs_analyze": analyze_text,
        "required_output": {
            "decision": "pass|revise|block",
            "confidence": "number 0..1",
            "reasons": ["string"],
            "canon_violations": ["string"],
            "revision_prompt": "string|null",
        },
    }
    jockey = await client.reason(json.dumps(reason_payload, separators=(",", ":")), instructions=JOCKEY_INSTRUCTIONS)
    text = _response_text(jockey)
    parsed = _extract_json(text) or {}
    decision = str(parsed.get("decision") or "revise").lower()
    if decision not in {"pass", "revise", "block"}:
        decision = "revise"
    reasons = [str(v) for v in parsed.get("reasons", []) if isinstance(v, (str, int, float))]
    violations = [str(v) for v in parsed.get("canon_violations", []) if isinstance(v, (str, int, float))]
    notes = (reasons + violations)[:50]

    qa = {
        "state": "passed" if decision == "pass" else decision,
        "decision": decision,
        "completed_at": _now(),
        "twelvelabs_asset_id": tl_asset_id,
        "twelvelabs_item_id": tl_item_id,
        "analyze_status": "completed",
        "analyze_assessment": analyze_text,
        "jockey_status": "completed",
        "jockey_response_id": jockey.get("id") or jockey.get("_id"),
        "jockey_review": parsed if parsed else {"raw": text[:12000]},
    }
    output["qa"] = qa
    await db.update_job(str(job["id"]), {"output": output})

    asset_rows = await db._request("GET", "ai_film_assets", params={"id": f"eq.{asset_id}", "select": "metadata", "limit": "1"})
    if asset_rows:
        meta = dict(asset_rows[0].get("metadata") or {})
        meta.update({"qa_state": decision, "twelvelabs_asset_id": tl_asset_id, "twelvelabs_item_id": tl_item_id, "jockey_response_id": qa["jockey_response_id"]})
        await db._request(
            "PATCH", "ai_film_assets", params={"id": f"eq.{asset_id}"},
            payload={"metadata": meta, "status": "approved" if decision == "pass" else "selected", "updated_at": _now()},
        )
    await _update_manifest_shot(db, manifest_row, shot_id, asset_id, decision, notes)
    return qa


async def run_generated_shot_qa_worker(*, environ: Mapping[str, str] | None = None, once: bool = False) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production" or not _enabled(source):
        return
    db = SupabaseAssemblyClient(source)
    poll = max(5.0, float(source.get("AI_FILM_GENERATED_SHOT_QA_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            await qa_generated_shot(job, db)
        except Exception as exc:
            output = dict(job.get("output") or {})
            qa = dict(output.get("qa") or {})
            qa.update({"state": "failed", "failed_at": _now(), "error": f"{type(exc).__name__}: {exc}"[:2000], "retryable": True})
            output["qa"] = qa
            await db.update_job(str(job["id"]), {"output": output})
        if once:
            return
