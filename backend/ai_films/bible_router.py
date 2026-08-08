"""Authenticated Production Bible + Shot Manifest API."""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.production_bible import ProductionBible, ShotManifest
from backend.ai_films.shot_compiler import CanonViolation, build_generation_packet

router = APIRouter(prefix="/ai-films/production", tags=["ai-films", "production-bible"])


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is empty")
    return token


async def _select(access_token: str, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon = os.getenv("SUPABASE_ANON_KEY", "")
    if not base or not anon:
        raise HTTPException(status_code=503, detail="Supabase runtime configuration is incomplete")
    headers = {"apikey": anon, "Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(f"{base}/rest/v1/{table}", headers=headers, params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"{table} query failed")
    payload = response.json()
    return [row for row in payload if isinstance(row, dict)] if isinstance(payload, list) else []


@router.get("/bible/{project_id}")
async def get_active_bible(project_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _token(authorization)
    rows = await _select(
        token,
        "ai_film_production_bibles",
        {"project_id": f"eq.{project_id}", "status": "in.(active,locked)", "order": "version.desc", "limit": "1", "select": "*"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No active Production Bible found")
    return rows[0]


@router.post("/bible", status_code=status.HTTP_201_CREATED)
async def create_bible_version(
    bible: ProductionBible,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _token(authorization)
    db = SupabaseRLSClient(token)
    try:
        user = await db.current_user()
        row = await db.insert(
            "ai_film_production_bibles",
            {
                "project_id": bible.project_id,
                "owner_id": user.id,
                "version": bible.version,
                "status": "active",
                "bible": bible.model_dump(mode="json"),
            },
        )
        return {"status": "created", "production_bible": row}
    except OrchestrationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/manifests/{project_id}")
async def list_manifests(project_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _token(authorization)
    rows = await _select(
        token,
        "ai_film_shot_manifests",
        {"project_id": f"eq.{project_id}", "order": "manifest_version.desc", "select": "*"},
    )
    return {"project_id": project_id, "manifests": rows}


@router.post("/manifests", status_code=status.HTTP_201_CREATED)
async def create_manifest(
    manifest: ShotManifest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _token(authorization)
    db = SupabaseRLSClient(token)
    try:
        user = await db.current_user()
        bible_rows = await _select(
            token,
            "ai_film_production_bibles",
            {"project_id": f"eq.{manifest.project_id}", "version": f"eq.{manifest.bible_version}", "limit": "1", "select": "bible"},
        )
        if not bible_rows:
            raise HTTPException(status_code=409, detail="Referenced Production Bible version does not exist")
        bible = ProductionBible.model_validate(bible_rows[0]["bible"])
        packets = []
        for shot in manifest.shots:
            try:
                packets.append(build_generation_packet(shot, bible))
            except CanonViolation as exc:
                raise HTTPException(status_code=409, detail=f"Canon violation in {shot.shot_id}: {exc}") from exc
        row = await db.insert(
            "ai_film_shot_manifests",
            {
                "project_id": manifest.project_id,
                "owner_id": user.id,
                "bible_version": manifest.bible_version,
                "manifest_version": manifest.manifest_version,
                "title": manifest.title,
                "structure": manifest.structure,
                "status": "active",
                "manifest": manifest.model_dump(mode="json"),
            },
        )
        return {"status": "created", "shot_manifest": row, "generation_packets": packets}
    except OrchestrationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/manifests/{project_id}/{manifest_version}/generation-packets")
async def generation_packets(
    project_id: str,
    manifest_version: int,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _token(authorization)
    rows = await _select(token, "ai_film_shot_manifests", {"project_id": f"eq.{project_id}", "manifest_version": f"eq.{manifest_version}", "limit": "1", "select": "manifest,bible_version"})
    if not rows:
        raise HTTPException(status_code=404, detail="Shot Manifest not found")
    bible_rows = await _select(token, "ai_film_production_bibles", {"project_id": f"eq.{project_id}", "version": f"eq.{rows[0]['bible_version']}", "limit": "1", "select": "bible"})
    if not bible_rows:
        raise HTTPException(status_code=409, detail="Production Bible unavailable")
    manifest = ShotManifest.model_validate(rows[0]["manifest"])
    bible = ProductionBible.model_validate(bible_rows[0]["bible"])
    return {"project_id": project_id, "manifest_version": manifest_version, "packets": [build_generation_packet(shot, bible) for shot in manifest.shots]}
