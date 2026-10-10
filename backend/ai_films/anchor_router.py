"""Authenticated Anchor Frame review API for AI Films."""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.anchor_frames import PROJECT_ID, approve_anchor
from backend.ai_films.assembly_worker import SupabaseAssemblyClient
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient

router = APIRouter(prefix="/ai-films/production/anchors", tags=["ai-films-production"])


class AnchorApprovalRequest(BaseModel):
    asset_id: str = Field(..., min_length=1, max_length=100)
    character_id: str = Field(..., min_length=1, max_length=120)


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Supabase bearer token required")
    value = authorization.split(" ", 1)[1].strip()
    if not value:
        raise HTTPException(status_code=401, detail="Bearer token is empty")
    return value


async def _require_owner(authorization: str | None) -> tuple[SupabaseAssemblyClient, str]:
    token = _token(authorization)
    try:
        user = await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc
    db = SupabaseAssemblyClient()
    projects = await db._request("GET", "ai_film_projects", params={"id": f"eq.{PROJECT_ID}", "select": "owner_id", "limit": "1"})
    if not projects or str(projects[0].get("owner_id")) != user.id:
        raise HTTPException(status_code=403, detail="AI Film project owner access required")
    return db, user.id


async def _signed_image_url(db: SupabaseAssemblyClient, object_path: str, expires_in: int = 1800) -> str:
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    headers = {"apikey": db.service_key, "Authorization": f"Bearer {db.service_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{db.base_url}/storage/v1/object/sign/{quote(db.bucket, safe='')}/{encoded}",
            headers=headers,
            json={"expiresIn": expires_in},
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Could not sign anchor candidate: HTTP {response.status_code}")
    payload = response.json()
    signed = payload.get("signedURL") or payload.get("signedUrl")
    if not signed:
        raise RuntimeError("Storage returned no signed anchor URL")
    if str(signed).startswith("http"):
        return str(signed)
    return f"{db.base_url}/storage/v1{signed if str(signed).startswith('/') else '/' + str(signed)}"


@router.get("/candidates")
async def list_anchor_candidates(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    db, _ = await _require_owner(authorization)
    rows = await db._request(
        "GET", "ai_film_assets",
        params={
            "project_id": f"eq.{PROJECT_ID}",
            "asset_type": "eq.image",
            "category": "eq.anchor-frame",
            "select": "id,title,status,metadata,created_at",
            "order": "created_at.asc",
        },
    )
    candidates: list[dict[str, Any]] = []
    for row in rows:
        meta = dict(row.get("metadata") or {})
        object_path = str(meta.get("storage_object_path") or "")
        signed_url = None
        if object_path:
            try:
                signed_url = await _signed_image_url(db, object_path)
            except Exception:
                signed_url = None
        candidates.append({
            "asset_id": row.get("id"),
            "title": row.get("title"),
            "status": row.get("status"),
            "approval_state": meta.get("approval_state"),
            "approved_character_id": meta.get("approved_character_id"),
            "shot_id": meta.get("shot_id"),
            "proposed_characters": meta.get("proposed_characters", []),
            "source_asset_id": meta.get("source_asset_id"),
            "source_start": meta.get("source_start"),
            "source_end": meta.get("source_end"),
            "preview_url": signed_url,
        })
    return {"project_id": PROJECT_ID, "candidates": candidates}


@router.post("/approve", status_code=status.HTTP_200_OK)
async def approve_anchor_candidate(request: AnchorApprovalRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    db, _ = await _require_owner(authorization)
    try:
        return await approve_anchor(db, asset_id=request.asset_id, character_id=request.character_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
