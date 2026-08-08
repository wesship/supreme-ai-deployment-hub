"""Match active Shot Manifest entries against indexed footage using TwelveLabs search."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Mapping

from backend.ai_films.assembly_worker import SupabaseAssemblyClient
from backend.ai_films.twelvelabs import TwelveLabsError
from backend.ai_films.twelvelabs_index import TwelveLabsIndexClient

PROJECT_ID = "b2979e7c-1d28-4024-bf4f-8db90c174d5a"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_conform_query(shot: Mapping[str, Any]) -> str:
    parts: list[str] = []
    for key in ("purpose", "action", "generation_prompt"):
        value = shot.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    characters = shot.get("characters")
    if isinstance(characters, list) and characters:
        parts.append("Characters: " + ", ".join(str(v) for v in characters))
    location_id = shot.get("location_id")
    if isinstance(location_id, str) and location_id:
        parts.append(f"Location: {location_id}")
    return " | ".join(parts)[:4000]


def normalize_candidates(payload: Mapping[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    rows = payload.get("data")
    if not isinstance(rows, list):
        rows = payload.get("clips")
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        video_id = row.get("video_id") or row.get("asset_id") or row.get("id")
        score = row.get("score") or row.get("confidence")
        start = row.get("start") or row.get("start_time")
        end = row.get("end") or row.get("end_time")
        metadata = row.get("user_metadata") if isinstance(row.get("user_metadata"), dict) else {}
        out.append({
            "video_id": video_id,
            "score": score,
            "start": start,
            "end": end,
            "ai_film_asset_id": metadata.get("ai_film_asset_id"),
            "source_id": metadata.get("source_id") or metadata.get("source_filename"),
        })
        if len(out) >= limit:
            break
    return out


async def conform_manifest(
    manifest_row: Mapping[str, Any],
    *,
    client: TwelveLabsIndexClient | None = None,
) -> dict[str, Any]:
    manifest = manifest_row.get("manifest") if isinstance(manifest_row.get("manifest"), dict) else {}
    shots = manifest.get("shots") if isinstance(manifest.get("shots"), list) else []
    search = client or TwelveLabsIndexClient()
    results: dict[str, Any] = {}
    for shot in shots:
        if not isinstance(shot, dict):
            continue
        shot_id = str(shot.get("shot_id") or "")
        if not shot_id:
            continue
        query = build_conform_query(shot)
        if not query:
            results[shot_id] = {"query": "", "candidates": [], "state": "no_query"}
            continue
        payload = await search.search(query, page_limit=5)
        candidates = normalize_candidates(payload, 5)
        results[shot_id] = {
            "query": query,
            "candidates": candidates,
            "state": "candidates_found" if candidates else "missing_coverage",
        }
    return {
        "state": "completed",
        "completed_at": _now(),
        "index_id": search.index_id,
        "shot_count": len(shots),
        "results": results,
    }


async def conform_active_manifest_on_startup(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = environ or os.environ
    if source.get("RAILWAY_ENVIRONMENT_NAME", "").strip().lower() != "production":
        return {"status": "skipped", "reason": "not_production"}
    if source.get("AI_FILM_MANIFEST_CONFORM_ENABLED", "true").strip().lower() in {"0", "false", "no", "off"}:
        return {"status": "skipped", "reason": "disabled"}

    db = SupabaseAssemblyClient(source)
    rows = await db._request(
        "GET",
        "ai_film_shot_manifests",
        params={
            "project_id": f"eq.{PROJECT_ID}",
            "status": "eq.active",
            "select": "*",
            "order": "manifest_version.desc",
            "limit": "1",
        },
    )
    if not rows:
        return {"status": "skipped", "reason": "no_active_manifest"}
    row = rows[0]
    manifest = dict(row.get("manifest") or {})
    metadata = dict(manifest.get("metadata") or {})
    if metadata.get("conform_state") == "completed":
        return {"status": "completed", "reason": "already_conformed"}

    try:
        conform = await conform_manifest(row)
    except TwelveLabsError as exc:
        metadata.update({"conform_state": "failed", "conform_error": str(exc)[:1000], "conform_failed_at": _now()})
        manifest["metadata"] = metadata
        await db._request(
            "PATCH",
            "ai_film_shot_manifests",
            params={"id": f"eq.{row['id']}"},
            payload={"manifest": manifest, "updated_at": _now()},
        )
        return {"status": "failed", "error": str(exc)}

    metadata.update({
        "conform_state": conform["state"],
        "conform_completed_at": conform["completed_at"],
        "conform_index_id": conform["index_id"],
        "conform_results": conform["results"],
    })
    manifest["metadata"] = metadata
    await db._request(
        "PATCH",
        "ai_film_shot_manifests",
        params={"id": f"eq.{row['id']}"},
        payload={"manifest": manifest, "updated_at": _now()},
    )
    return {"status": "completed", "shot_count": conform["shot_count"], "index_id": conform["index_id"]}
