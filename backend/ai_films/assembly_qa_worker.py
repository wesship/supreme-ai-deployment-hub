"""Post-render TwelveLabs Analyze + Jockey QA for AI Films assembly masters."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Mapping
from urllib.parse import quote

import httpx

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.ingestion import TwelveLabsIngestionRunner
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError
from backend.ai_films.twelvelabs_analyze import TwelveLabsAnalyzeClient

logger = logging.getLogger(__name__)

ANALYZE_PROMPT = (
    "Evaluate this finished film assembly as a senior editor. Check narrative coherence, "
    "character continuity, wardrobe/location continuity, screen direction, pacing, dialogue "
    "causality, visual discontinuities, abrupt edits, audio discontinuities, and missing coverage. "
    "Return a concise structured assessment with pass/fail risks and concrete timestamps when possible."
)

JOCKEY_QA_INSTRUCTIONS = (
    "You are the D3VONN.IO final picture-lock QA supervisor. Compare the newly assembled master "
    "against the rest of The Sovereign Signal corpus and established continuity. Identify contradictions, "
    "missing narrative bridges, duplicated beats, character/wardrobe/location mismatches, and pacing problems. "
    "Be conservative: do not invent events not grounded in the corpus."
)


def _text(payload: Mapping[str, Any], limit: int = 10000) -> str:
    for key in ("output_text", "text", "response", "content"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:limit]
    output = payload.get("output")
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if isinstance(content, str):
                chunks.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        value = part.get("text") or part.get("content")
                        if isinstance(value, str):
                            chunks.append(value)
        return "\n".join(chunks).strip()[:limit]
    return ""


async def _sign_master(db: SupabaseAssemblyClient, object_path: str, expires_in: int = 3600) -> str:
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    headers = {
        "apikey": db.service_key,
        "Authorization": f"Bearer {db.service_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        response = await client.post(
            f"{db.base_url}/storage/v1/object/sign/{quote(db.bucket, safe='')}/{encoded}",
            headers=headers,
            json={"expiresIn": expires_in},
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Could not sign assembly master: HTTP {response.status_code}")
    payload = response.json()
    signed = payload.get("signedURL") or payload.get("signedUrl")
    if not isinstance(signed, str) or not signed:
        raise RuntimeError("Supabase Storage did not return a signed URL")
    if signed.startswith("http"):
        return signed
    return f"{db.base_url}/storage/v1{signed if signed.startswith('/') else '/' + signed}"


async def _claim_next_qa_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.assembly",
            "provider": "eq.ffmpeg",
            "status": "eq.completed",
            "output->qa->>state": "eq.pending_post_render_qa",
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
        params={"id": f"eq.{job['id']}", "output->qa->>state": "eq.pending_post_render_qa"},
        payload={"output": output, "updated_at": _now()},
        representation=True,
    )
    return claimed[0] if claimed else None


async def qa_assembly_job(job: Mapping[str, Any], db: SupabaseAssemblyClient) -> dict[str, Any]:
    job_id = str(job.get("id") or "")
    project_id = str(job.get("project_id") or "")
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    object_path = str(output.get("object_path") or "")
    if not object_path:
        raise RuntimeError("Completed assembly has no durable storage object path")

    signed_url = await _sign_master(db, object_path)
    client = TwelveLabsClient()
    runner = TwelveLabsIngestionRunner(client)
    created = await runner._create_asset(
        url=signed_url,
        filename=f"assembly-{job_id}.mp4",
        user_metadata={
            "d3vonn_project_id": project_id,
            "assembly_job_id": job_id,
            "asset_role": "assembled_master",
        },
    )
    asset_id = str(created.get("_id") or created.get("id") or "")
    if not asset_id:
        raise TwelveLabsError("Post-render QA asset creation returned no id")
    await runner._wait_for_asset(asset_id, timeout_seconds=600.0, poll_interval_seconds=5.0)

    analyze_payload: dict[str, Any] = {}
    analyze_text = ""
    if qa.get("final_twelvelabs_analyze_requested", True):
        analyze_payload = await TwelveLabsAnalyzeClient().analyze_asset(
            asset_id,
            ANALYZE_PROMPT,
            model_name="pegasus1.5",
            temperature=0.1,
            max_tokens=4096,
        )
        analyze_text = _text(analyze_payload)

    item = await runner._create_item(
        asset_id,
        metadata={
            "d3vonn_project_id": project_id,
            "assembly_job_id": job_id,
            "asset_role": "assembled_master",
        },
    )
    item_id = str(item.get("_id") or item.get("id") or "")
    if not item_id:
        raise TwelveLabsError("Post-render QA knowledge-store item creation returned no id")
    await runner._wait_for_item(item_id, timeout_seconds=1200.0, poll_interval_seconds=5.0)

    jockey = await client.reason(
        json.dumps(
            {
                "task": "Final picture-lock continuity and editorial QA for newly assembled master.",
                "assembly_job_id": job_id,
                "analyze_assessment": analyze_text,
                "requirements": [
                    "Compare the finished master against the corpus.",
                    "Flag continuity contradictions and missing bridges.",
                    "Assess pacing and intelligibility.",
                    "Give a release recommendation: pass, revise, or block.",
                ],
            },
            separators=(",", ":"),
        ),
        instructions=JOCKEY_QA_INSTRUCTIONS,
    )
    jockey_text = _text(jockey)

    qa.update(
        {
            "state": "passed",
            "completed_at": _now(),
            "twelvelabs_asset_id": asset_id,
            "twelvelabs_item_id": item_id,
            "analyze_status": "completed" if analyze_payload else "skipped",
            "analyze_assessment": analyze_text,
            "jockey_status": "completed",
            "jockey_response_id": jockey.get("id") or jockey.get("_id"),
            "jockey_assessment": jockey_text,
            "error": None,
        }
    )
    output["qa"] = qa
    await db.update_job(job_id, {"output": output})
    return qa


async def run_assembly_qa_worker(
    *, environ: Mapping[str, str] | None = None, once: bool = False
) -> None:
    source = environ or os.environ
    if source.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() != "production":
        return
    if source.get("AI_FILM_ASSEMBLY_QA_ENABLED", "true").strip().lower() in {"0", "false", "no", "off"}:
        return
    db = SupabaseAssemblyClient(source)
    poll_seconds = max(5.0, float(source.get("AI_FILM_ASSEMBLY_QA_POLL_SECONDS", "15") or 15))
    while True:
        job = await _claim_next_qa_job(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll_seconds)
            continue
        job_id = str(job.get("id") or "")
        try:
            await qa_assembly_job(job, db)
            logger.info("AI Films post-render QA passed for assembly %s", job_id)
        except Exception as exc:
            logger.exception("AI Films post-render QA failed for assembly %s", job_id)
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
            await db.update_job(job_id, {"output": output})
        if once:
            return
