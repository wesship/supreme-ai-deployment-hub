"""Anchor-frame candidate extraction and canon approval for AI Films."""
from __future__ import annotations

import asyncio
import hashlib
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote

import httpx

from backend.ai_films.assembly_worker import SupabaseAssemblyClient, resolve_asset_source

PROJECT_ID = "b2979e7c-1d28-4024-bf4f-8db90c174d5a"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _download(url: str, target: Path) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=15), follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            if response.status_code >= 400:
                raise RuntimeError(f"Anchor source download failed with HTTP {response.status_code}")
            with target.open("wb") as handle:
                async for chunk in response.aiter_bytes():
                    handle.write(chunk)


async def _extract_frame(video: Path, target: Path, timestamp: float) -> None:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{max(0, timestamp):.3f}", "-i", str(video),
        "-frames:v", "1", "-q:v", "2", str(target),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0 or not target.exists() or target.stat().st_size == 0:
        raise RuntimeError(f"Anchor frame extraction failed: {stderr.decode(errors='replace')[-800:]}")


async def _upload_jpeg(db: SupabaseAssemblyClient, local_path: Path, object_path: str) -> dict[str, Any]:
    data = local_path.read_bytes()
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    headers = {
        "apikey": db.service_key,
        "Authorization": f"Bearer {db.service_key}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15)) as client:
        response = await client.post(
            f"{db.base_url}/storage/v1/object/{quote(db.bucket, safe='')}/{encoded}",
            headers=headers, content=data,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Anchor upload failed with HTTP {response.status_code}")
    return {"object_path": object_path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def _candidate_rows(manifest: Mapping[str, Any]) -> list[dict[str, Any]]:
    metadata = manifest.get("metadata") if isinstance(manifest.get("metadata"), dict) else {}
    conform = metadata.get("conform_results") if isinstance(metadata.get("conform_results"), dict) else {}
    shots = manifest.get("shots") if isinstance(manifest.get("shots"), list) else []
    shot_map = {str(s.get("shot_id")): s for s in shots if isinstance(s, dict) and s.get("shot_id")}
    rows: list[dict[str, Any]] = []
    for shot_id, result in conform.items():
        if not isinstance(result, dict):
            continue
        candidates = result.get("candidates") if isinstance(result.get("candidates"), list) else []
        if not candidates:
            continue
        candidate = candidates[0] if isinstance(candidates[0], dict) else {}
        asset_id = str(candidate.get("ai_film_asset_id") or "")
        if not asset_id:
            continue
        start = float(candidate.get("start") or 0)
        end = float(candidate.get("end") or start)
        shot = shot_map.get(str(shot_id), {})
        rows.append({
            "shot_id": str(shot_id),
            "source_asset_id": asset_id,
            "source_start": start,
            "source_end": end,
            "timestamp": start + max(0, end - start) / 2,
            "proposed_characters": list(shot.get("characters") or []),
        })
    return rows


async def extract_anchor_candidates_on_startup(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).lower() != "production":
        return {"status": "skipped", "reason": "not_production"}
    if str(source.get("AI_FILM_ANCHOR_CANDIDATES_ENABLED", "true")).lower() in {"0", "false", "no", "off"}:
        return {"status": "skipped", "reason": "disabled"}
    db = SupabaseAssemblyClient(source)
    manifests = await db._request("GET", "ai_film_shot_manifests", params={
        "project_id": f"eq.{PROJECT_ID}", "status": "eq.active", "select": "*", "order": "manifest_version.desc", "limit": "1"
    })
    if not manifests:
        return {"status": "skipped", "reason": "no_manifest"}
    row = manifests[0]
    manifest = dict(row.get("manifest") or {})
    metadata = dict(manifest.get("metadata") or {})
    if metadata.get("anchor_candidate_state") == "completed":
        return {"status": "completed", "reason": "already_extracted"}

    created: list[dict[str, Any]] = []
    for candidate in _candidate_rows(manifest):
        asset = await db.get_asset(candidate["source_asset_id"])
        if not asset:
            continue
        try:
            media = resolve_asset_source(asset)
        except Exception:
            continue
        with tempfile.TemporaryDirectory(prefix="d3vonn-anchor-") as tmp:
            root = Path(tmp)
            video = root / (media.source_filename or "source.mp4")
            frame = root / "anchor.jpg"
            await _download(media.media_url, video)
            await _extract_frame(video, frame, candidate["timestamp"])
            object_path = f"{PROJECT_ID}/anchors/candidates/{candidate['shot_id']}.jpg"
            stored = await _upload_jpeg(db, frame, object_path)
        payload = {
            "project_id": PROJECT_ID,
            "owner_id": row.get("owner_id"),
            "asset_type": "image",
            "title": f"{candidate['shot_id']} — anchor candidate",
            "description": "Extracted from existing footage for explicit canon identity approval.",
            "storage_path": f"supabase://{db.bucket}/{object_path}",
            "source_filename": f"{candidate['shot_id']}-anchor.jpg",
            "category": "anchor-frame",
            "subcategory": "candidate",
            "status": "selected",
            "version": 1,
            "tags": ["ai-films", "anchor-candidate", candidate["shot_id"]],
            "metadata": {
                "source_type": "extracted_frame",
                "storage_bucket": db.bucket,
                "storage_object_path": object_path,
                **candidate,
                "approval_state": "pending",
            },
            "checksum": stored["sha256"],
        }
        assets = await db._request("POST", "ai_film_assets", payload=payload, representation=True)
        if assets:
            created.append({"asset_id": assets[0]["id"], **candidate})

    metadata.update({"anchor_candidate_state": "completed", "anchor_candidate_completed_at": _now(), "anchor_candidates": created})
    manifest["metadata"] = metadata
    await db._request("PATCH", "ai_film_shot_manifests", params={"id": f"eq.{row['id']}"}, payload={"manifest": manifest, "updated_at": _now()})
    return {"status": "completed", "created": len(created), "candidates": created}


async def approve_anchor(db: SupabaseAssemblyClient, *, asset_id: str, character_id: str) -> dict[str, Any]:
    assets = await db._request("GET", "ai_film_assets", params={"id": f"eq.{asset_id}", "project_id": f"eq.{PROJECT_ID}", "select": "*", "limit": "1"})
    if not assets:
        raise ValueError("Anchor candidate not found")
    asset = assets[0]
    meta = dict(asset.get("metadata") or {})
    if asset.get("asset_type") != "image" or asset.get("category") != "anchor-frame" or meta.get("approval_state") not in {"pending", "approved"}:
        raise ValueError("Asset is not an approvable anchor candidate")

    bibles = await db._request("GET", "ai_film_production_bibles", params={"project_id": f"eq.{PROJECT_ID}", "status": "eq.active", "select": "*", "order": "version.desc", "limit": "1"})
    if not bibles:
        raise RuntimeError("Active Production Bible not found")
    bible_row = bibles[0]
    bible = dict(bible_row.get("bible") or {})
    found = False
    for character in bible.get("characters", []):
        if isinstance(character, dict) and str(character.get("character_id")) == character_id:
            anchors = list(character.get("anchor_asset_ids") or [])
            if asset_id not in anchors:
                anchors.append(asset_id)
            character["anchor_asset_ids"] = anchors
            found = True
            break
    if not found:
        raise ValueError("Character does not exist in active Production Bible")

    meta.update({"approval_state": "approved", "approved_character_id": character_id, "approved_at": _now()})
    await db._request("PATCH", "ai_film_assets", params={"id": f"eq.{asset_id}"}, payload={"status": "canon", "metadata": meta, "updated_at": _now()})
    await db._request("PATCH", "ai_film_production_bibles", params={"id": f"eq.{bible_row['id']}"}, payload={"bible": bible, "updated_at": _now()})
    return {"status": "approved", "asset_id": asset_id, "character_id": character_id}
