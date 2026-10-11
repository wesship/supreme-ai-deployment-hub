"""Authenticated metadata handoff. No provider dispatch or imported approvals.

All Data API and Storage calls use the caller's token, never service-role bypass.
Existing AI Film project/scene/asset policies remain authoritative.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Literal
from urllib.parse import quote, urlsplit
from uuid import UUID, NAMESPACE_URL, uuid5

import httpx
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter(prefix="/ai-films/avatar-studio", tags=["avatar-studio"])
TEMPLATES = Literal["news_anchor", "avatar_podcast", "interview", "onboarding_demo", "teacher_lesson", "instructor_workshop", "cinematic_character"]
STAGES = Literal["authoring", "review", "render", "export"]
CLAIMS = Literal["draft", "review", "ready", "render_blocked", "render_completed", "exported"]
BLOCKERS = ["Server-verified likeness and voice consent required", "MuseTalk GPU worker and dispatch not certified", "Editorial approval must be verified against current content"]


class StageClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage: STAGES
    status: CLAIMS


class HandoffRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    title: str = Field(min_length=1, max_length=160)
    template: TEMPLATES
    stage_claims: list[StageClaim] = Field(min_length=4, max_length=4)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title cannot be blank")
        return value.strip()

    @field_validator("stage_claims")
    @classmethod
    def distinct_stages(cls, value: list[StageClaim]) -> list[StageClaim]:
        if len({s.stage for s in value}) != 4:
            raise ValueError("all four stages must appear exactly once")
        return sorted(value, key=lambda s: s.stage)


class CallerStore:
    def __init__(self, token: str, transport=None):
        self.base = os.getenv("SUPABASE_URL", "").rstrip("/")
        key = os.getenv("SUPABASE_ANON_KEY", "")
        if not self.base or not key:
            raise HTTPException(503, "Avatar handoff store is not configured")
        self.headers = {"apikey": key, "Authorization": f"Bearer {token}"}
        self.transport = transport

    async def request(self, method, path, *, params=None, payload=None):
        try:
            async with httpx.AsyncClient(timeout=15, transport=self.transport, follow_redirects=False) as client:
                result = await client.request(method, f"{self.base}/{path}", params=params, json=payload,
                                              headers={**self.headers, "Prefer": "return=representation"})
        except httpx.RequestError as exc:
            raise HTTPException(503, "Avatar handoff store unavailable") from exc
        if result.status_code in (401, 403):
            raise HTTPException(result.status_code, "Avatar handoff access denied")
        if result.status_code == 409:
            raise HTTPException(409, "Handoff conflict")
        if result.status_code >= 400:
            raise HTTPException(503, "Avatar handoff store unavailable")
        try:
            return result.json()
        except ValueError as exc:
            raise HTTPException(503, "Avatar handoff store returned invalid data") from exc


async def authenticated(authorization: str | None) -> tuple[CallerStore, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to D3VONN to use the Studio handoff")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Bearer token required")
    store = CallerStore(token)
    user = await store.request("GET", "auth/v1/user")
    try:
        actor = str(UUID(user["id"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(401, "Verified account required") from exc
    if user.get("is_anonymous") is True:
        raise HTTPException(403, "A registered account is required")
    return store, actor


def enabled():
    if os.getenv("AI_FILMS_AVATAR_HANDOFF_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(404, "Avatar handoff is not enabled")


async def owned_project(store, actor, project_id):
    rows = await store.request("GET", "rest/v1/ai_film_projects", params={
        "id": f"eq.{project_id}", "owner_id": f"eq.{actor}", "select": "id,owner_id,title", "limit": "1"})
    if not isinstance(rows, list) or len(rows) != 1 or rows[0].get("owner_id") != actor:
        raise HTTPException(404, "Owned project unavailable")
    return rows[0]


def handoff_summary(row):
    package = row.get("production_package", {})
    if row.get("status") != "draft" or not isinstance(package, dict) or package.get("schema") != "d3vonn.avatar-handoff.v1":
        raise HTTPException(404, "Studio draft unavailable")
    return {"id": row["id"], "status": "draft", "execution": "blocked", "content_hash": package["content_hash"],
            "template": package["template"], "blockers": BLOCKERS}


@router.get("/status")
async def runtime_status(response: Response, authorization: str | None = Header(default=None)):
    await authenticated(authorization)
    response.headers["Cache-Control"] = "no-store"
    return {"authenticated": True, "handoff_enabled": os.getenv("AI_FILMS_AVATAR_HANDOFF_ENABLED", "").lower() in {"1", "true", "yes"},
            "render_enabled": False, "live_enabled": False, "consent_verified": False, "blockers": BLOCKERS}


@router.get("/projects")
async def projects(response: Response, authorization: str | None = Header(default=None)):
    store, actor = await authenticated(authorization)
    enabled()
    response.headers["Cache-Control"] = "no-store"
    rows = await store.request("GET", "rest/v1/ai_film_projects", params={
        "owner_id": f"eq.{actor}", "select": "id,title", "order": "created_at.desc,id.desc", "limit": "51"})
    if not isinstance(rows, list):
        raise HTTPException(503, "Invalid project list")
    return {"items": rows[:50], "has_more": len(rows) > 50}


@router.post("/projects/{project_id}/handoffs")
async def save_handoff(project_id: UUID, body: HandoffRequest, response: Response,
                       authorization: str | None = Header(default=None)):
    store, actor = await authenticated(authorization)
    enabled()
    await owned_project(store, actor, project_id)
    response.headers["Cache-Control"] = "no-store"
    summary = body.model_dump(mode="json", exclude={"request_id"})
    digest = hashlib.sha256(json.dumps(summary, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    ident = str(uuid5(NAMESPACE_URL, f"d3vonn:avatar-handoff:{project_id}:{actor}:{body.request_id}"))
    existing = await store.request("GET", "rest/v1/ai_film_scenes", params={
        "id": f"eq.{ident}", "project_id": f"eq.{project_id}", "owner_id": f"eq.{actor}",
        "select": "id,status,production_package", "limit": "1"})
    if existing:
        result = handoff_summary(existing[0])
        if result["content_hash"] != digest:
            raise HTTPException(409, "This request id was used for a different handoff")
        return result
    package = {"schema": "d3vonn.avatar-handoff.v1", "content_hash": digest, "template": body.template,
               "imported_stage_claims": summary["stage_claims"], "claims_verified": False, "execution": "blocked"}
    record = {"id": ident, "project_id": str(project_id), "owner_id": actor, "episode_number": None,
              "scene_number": 1, "title": body.title, "status": "draft", "production_package": package,
              "canon_validation": {"status": "pending", "violations": []}}
    try:
        rows = await store.request("POST", "rest/v1/ai_film_scenes", payload=record)
    except HTTPException as exc:
        if exc.status_code != 409:
            raise
        # Concurrent identical retry: only return the persisted matching draft.
        rows = await store.request("GET", "rest/v1/ai_film_scenes", params={"id": f"eq.{ident}",
            "project_id": f"eq.{project_id}", "owner_id": f"eq.{actor}", "select": "id,status,production_package", "limit": "1"})
        if not rows or handoff_summary(rows[0])["content_hash"] != digest:
            raise HTTPException(409, "Handoff conflict") from exc
    if not isinstance(rows, list) or len(rows) != 1:
        raise HTTPException(503, "Handoff persistence could not be confirmed")
    return handoff_summary(rows[0])


@router.post("/projects/{project_id}/render")
async def submit_render(project_id: UUID, authorization: str | None = Header(default=None)):
    store, actor = await authenticated(authorization)
    enabled()
    await owned_project(store, actor, project_id)
    raise HTTPException(503, "MuseTalk dispatch is not certified; no job was created")


@router.get("/projects/{project_id}/jobs/{job_id}/artifact")
async def artifact(project_id: UUID, job_id: UUID, response: Response,
                   authorization: str | None = Header(default=None)):
    store, actor = await authenticated(authorization)
    enabled()
    await owned_project(store, actor, project_id)
    response.headers["Cache-Control"] = "no-store"
    rows = await store.request("GET", "rest/v1/ai_film_render_jobs", params={
        "id": f"eq.{job_id}", "project_id": f"eq.{project_id}", "owner_id": f"eq.{actor}",
        "select": "status,output", "limit": "1"})
    if not rows or rows[0].get("status") not in {"completed", "succeeded"}:
        raise HTTPException(404, "Completed job unavailable")
    output = rows[0].get("output") or {}
    if not isinstance(output, dict):
        raise HTTPException(409, "Job output is invalid")
    try:
        asset_id = str(UUID(output.get("generated_asset_id", "")))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(409, "Job has no registered output asset") from exc
    assets = await store.request("GET", "rest/v1/ai_film_assets", params={
        "id": f"eq.{asset_id}", "project_id": f"eq.{project_id}", "owner_id": f"eq.{actor}",
        "select": "id,storage_path,metadata,status", "limit": "1"})
    if not assets or assets[0].get("status") in {"archived", "rejected"}:
        raise HTTPException(404, "Output asset unavailable")
    asset = assets[0]
    meta = asset.get("metadata") or {}
    if not isinstance(meta, dict):
        raise HTTPException(409, "Output provenance unavailable")
    path = asset.get("storage_path")
    bucket = meta.get("storage_bucket")
    if meta.get("render_job_id") != str(job_id) or bucket not in {"ai-film-media", "ai-film-renders"}:
        raise HTTPException(409, "Output provenance unavailable")
    if not isinstance(path, str) or not re.fullmatch(r"[A-Za-z0-9_./-]+", path) or any(p in {"", ".", ".."} for p in path.split("/")) or path.split("/")[0] not in {actor, str(project_id)}:
        raise HTTPException(409, "Output storage path rejected")
    # Signing with the caller's JWT also enforces Storage SELECT policies.
    signed = await store.request("POST", f"storage/v1/object/sign/{bucket}/{quote(path, safe='/')}", payload={"expiresIn": 60})
    if not isinstance(signed, dict):
        raise HTTPException(503, "Storage returned an invalid signed output")
    url = signed.get("signedURL") or signed.get("signedUrl")
    if not isinstance(url, str):
        raise HTTPException(503, "Storage did not return a signed output")
    expected = f"/object/sign/{bucket}/{quote(path, safe='/')}"
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        base = urlsplit(store.base)
        if parsed.scheme != base.scheme or parsed.netloc != base.netloc or parsed.path != f"/storage/v1{expected}":
            raise HTTPException(503, "Storage returned an unexpected output URL")
    elif parsed.path != expected:
        raise HTTPException(503, "Storage returned an unexpected output URL")
    else:
        url = f"{store.base}/storage/v1{url}"
    if not parsed.query or parsed.fragment:
        raise HTTPException(503, "Storage returned an invalid signed output")
    return {"asset_id": asset_id, "url": url, "expires_in": 60, "publication_approved": False}
