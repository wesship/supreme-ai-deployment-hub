"""Project-scoped character identities with independent role revisions and releases."""
from __future__ import annotations

import os
import re
from urllib.parse import urlencode
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from backend.ai_films.assembly_worker import AssemblyWorkerError
from backend.ai_films.character_sources import SourceUnavailable, load_approved_sources, search_sources, source_hash
from backend.ai_films.role_authoring_router import DraftRequest, Store, TestRequest, TransitionRequest, _service
from backend.ai_films.role_policy_attestation import InvalidAttestation, issue_policy_attestation
from backend.ai_films.role_runtime import ROLE_TOOLS, RoleProfileUnavailable, load_published_role
from backend.app.routers.voice_orchestration import _inline_assistant, _public_api_url
from backend.app.voice_session import issue_voice_session

router = APIRouter(prefix="/ai-films/projects/{project_id}/characters", tags=["ai-films-characters"])
source_router = APIRouter(prefix="/ai-films/projects/{project_id}/sources", tags=["ai-films-character-sources"])


def _sources_enabled() -> None:
    if os.getenv("AI_FILMS_CHARACTER_SOURCES_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Character sources are unavailable")


class SourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    content: str = Field(..., min_length=1, max_length=12000)
    rights_basis: str = Field(..., min_length=1, max_length=500)


class SourceQuestion(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    description: str = Field(default="", max_length=1000)
    avatar_version: str = Field(..., min_length=1, max_length=160)


async def access(db: Store, project_id: UUID, actor: str, *, edit: bool = False, owner: bool = False) -> None:
    try:
        projects = await db._request("GET", "ai_film_projects", params={
            "id": f"eq.{project_id}", "select": "owner_id", "limit": "1"})
        if not projects:
            raise HTTPException(status_code=404, detail="Project is unavailable")
        if projects[0]["owner_id"] == actor:
            return
        if owner:
            raise HTTPException(status_code=403, detail="Project owner access required")
        roles = "in.(producer,director,writer,editor)" if edit else "in.(producer,director,writer,editor,reviewer)"
        members = await db._request("GET", "ai_film_collaborators", params={
            "project_id": f"eq.{project_id}", "user_id": f"eq.{actor}",
            "status": "eq.active", "role": roles, "select": "id", "limit": "1"})
        if not members:
            raise HTTPException(status_code=403, detail="Project collaborator access required")
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character store unavailable") from exc


async def character(db: Store, project_id: UUID, character_id: UUID, *, active: bool = True) -> dict:
    try:
        rows = await db._request("GET", "ai_film_characters", params={
            "project_id": f"eq.{project_id}", "id": f"eq.{character_id}",
            **({"status": "eq.active"} if active else {}), "select": "id,name,slug,description,avatar_version,status", "limit": "1"})
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character store unavailable") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Active character is unavailable")
    return rows[0]


@source_router.get("")
async def list_sources(project_id: UUID, page: int = Query(default=0, ge=0),
                       authorization: str | None = Header(default=None)) -> dict:
    _sources_enabled()
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    try:
        rows = await service.store._request("GET", "ai_film_character_sources", params={
            "project_id": f"eq.{project_id}", "select": "id,title,content_hash,rights_basis,status,created_by,approved_by,created_at",
            "order": "created_at.desc,id.desc", "limit": "51", "offset": str(page * 50)})
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Source store unavailable") from exc
    return {"items": rows[:50], "has_more": len(rows) > 50}


@source_router.post("", status_code=201)
async def submit_source(project_id: UUID, request: SourceCreate,
                        authorization: str | None = Header(default=None)) -> dict:
    _sources_enabled()
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, edit=True)
    title, content, rights = request.title.strip(), request.content.strip(), request.rights_basis.strip()
    if not title or not content or not rights:
        raise HTTPException(status_code=422, detail="Source title, content, and rights basis are required")
    record = {"id": str(uuid4()), "project_id": str(project_id), "title": title,
              "content": content, "content_hash": source_hash(content),
              "rights_basis": rights, "created_by": actor}
    try:
        rows = await service.store._request("POST", "ai_film_character_sources",
                                            payload=record, representation=True)
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Source store unavailable") from exc
    return {key: rows[0][key] for key in ("id", "title", "content_hash", "status")}


@source_router.get("/{source_id}")
async def read_source(project_id: UUID, source_id: UUID,
                      authorization: str | None = Header(default=None)) -> dict:
    _sources_enabled()
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    try:
        rows = await service.store._request("GET", "ai_film_character_sources", params={
            "project_id": f"eq.{project_id}", "id": f"eq.{source_id}",
            "select": "id,title,content,content_hash,rights_basis,status,created_by,approved_by",
            "limit": "1"})
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Source store unavailable") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Source unavailable")
    if source_hash(rows[0]["content"]) != rows[0]["content_hash"]:
        raise HTTPException(status_code=409, detail="Source integrity check failed")
    return rows[0]


async def _source_transition(action: str, project_id: UUID, source_id: UUID,
                             authorization: str | None) -> dict:
    _sources_enabled()
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    async with httpx.AsyncClient(headers=service.store.headers, timeout=30,
                                 transport=service.store._transport) as client:
        result = await client.post(
            f"{service.store.base_url}/rest/v1/rpc/ai_film_character_source_advance",
            json={"p_action": action, "p_project_id": str(project_id),
                  "p_source_id": str(source_id), "p_actor_id": actor})
    if result.status_code == 403:
        raise HTTPException(status_code=403, detail="Source transition denied")
    if result.status_code >= 400:
        raise HTTPException(status_code=409, detail="Source transition unavailable or invalid")
    return result.json()


@source_router.post("/{source_id}/approve")
async def approve_source(project_id: UUID, source_id: UUID,
                         authorization: str | None = Header(default=None)) -> dict:
    return await _source_transition("approve", project_id, source_id, authorization)


@source_router.post("/{source_id}/revoke")
async def revoke_source(project_id: UUID, source_id: UUID,
                        authorization: str | None = Header(default=None)) -> dict:
    return await _source_transition("revoke", project_id, source_id, authorization)


@router.get("")
async def list_characters(project_id: UUID, page: int = Query(default=0, ge=0),
                          authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    try:
        rows = await service.store._request("GET", "ai_film_characters", params={
            "project_id": f"eq.{project_id}", "status": "eq.active", "select": "id,name,slug,description,avatar_version,status",
            "order": "created_at.asc,id.asc", "limit": "51", "offset": str(page * 50)})
        return {"items": rows[:50], "has_more": len(rows) > 50}
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character store unavailable") from exc


@router.post("", status_code=201)
async def create_character(project_id: UUID, request: CharacterCreate,
                           authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, edit=True)
    if not request.name.strip() or not request.avatar_version.strip():
        raise HTTPException(status_code=422, detail="Character name and avatar version are required")
    record = {"id": str(uuid4()), "project_id": str(project_id), "name": request.name.strip(),
              "slug": request.slug, "description": request.description,
              "avatar_version": request.avatar_version.strip(), "created_by": actor}
    try:
        rows = await service.store._request("POST", "ai_film_characters", payload=record,
                                            representation=True)
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=409, detail="Character slug is already used or store unavailable") from exc
    return {key: rows[0][key] for key in ("id", "name", "slug", "description", "avatar_version", "status")}


@router.get("/{character_id}/roles/{role_id}/draft")
async def read_draft(project_id: UUID, character_id: UUID, role_id: str,
                     authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    await character(service.store, project_id, character_id)
    if role_id not in ROLE_TOOLS:
        raise HTTPException(status_code=404, detail="Role is unavailable")
    try:
        rows = await service.store._request("GET", "ai_film_character_role_drafts", params={
            "project_id": f"eq.{project_id}", "character_id": f"eq.{character_id}",
            "role_id": f"eq.{role_id}", "select": "revision,status,profile,profile_hash,tested_hash,editor_id,reviewer_id,published_version", "limit": "1"})
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character draft store unavailable") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Role draft is unavailable")
    return rows[0]


@router.put("/{character_id}/roles/{role_id}/draft")
async def save_draft(project_id: UUID, character_id: UUID, role_id: str, request: DraftRequest,
                     authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, edit=True)
    await character(service.store, project_id, character_id)
    try:
        return await service.save(str(project_id), role_id, actor, request.expected_revision,
                                  request.profile, character_id=str(character_id))
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{character_id}/roles/{role_id}/policy-check")
async def policy_check(project_id: UUID, character_id: UUID, role_id: str, request: TransitionRequest,
                       authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, edit=True)
    await character(service.store, project_id, character_id)
    saved = await read_draft(project_id, character_id, role_id, authorization)
    if saved["revision"] != request.revision or saved["status"] != "draft":
        raise HTTPException(status_code=409, detail="Current draft revision required")
    try:
        token = issue_policy_attestation(str(project_id), role_id, request.revision,
                                         saved["profile"], character_id=str(character_id))
    except (InvalidAttestation, RoleProfileUnavailable) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Role policy test unavailable") from exc
    return {"attestation": token, "expires_in_seconds": 600}


async def _advance(action: str, project_id: UUID, character_id: UUID, role_id: str,
                   request: TransitionRequest, authorization: str | None) -> dict:
    # The SQL transaction checks the actor again and serializes each character/role.
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    await character(service.store, project_id, character_id)
    try:
        if action == "test":
            if not isinstance(request, TestRequest):
                raise HTTPException(status_code=422, detail="Attestation required")
            return await service.mark_tested(str(project_id), role_id, actor, request.revision,
                                             request.attestation, character_id=str(character_id))
        return await service.transition(action, str(project_id), role_id, actor, request.revision,
                                        character_id=str(character_id))
    except (InvalidAttestation, RoleProfileUnavailable) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character role store unavailable") from exc


@router.post("/{character_id}/roles/{role_id}/test")
async def test_role(project_id: UUID, character_id: UUID, role_id: str, request: TestRequest,
                    authorization: str | None = Header(default=None)) -> dict:
    return await _advance("test", project_id, character_id, role_id, request, authorization)


@router.post("/{character_id}/roles/{role_id}/submit-review")
async def submit_role(project_id: UUID, character_id: UUID, role_id: str, request: TransitionRequest,
                      authorization: str | None = Header(default=None)) -> dict:
    return await _advance("submit", project_id, character_id, role_id, request, authorization)


@router.post("/{character_id}/roles/{role_id}/approve")
async def approve_role(project_id: UUID, character_id: UUID, role_id: str, request: TransitionRequest,
                       authorization: str | None = Header(default=None)) -> dict:
    return await _advance("approve", project_id, character_id, role_id, request, authorization)


@router.post("/{character_id}/roles/{role_id}/publish")
async def publish_role(project_id: UUID, character_id: UUID, role_id: str, request: TransitionRequest,
                       authorization: str | None = Header(default=None)) -> dict:
    return await _advance("publish", project_id, character_id, role_id, request, authorization)


@router.get("/{character_id}/roles/{role_id}/published")
async def published_role(project_id: UUID, character_id: UUID, role_id: str,
                         authorization: str | None = Header(default=None)) -> dict:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, owner=True)
    await character(service.store, project_id, character_id)
    try:
        return await load_published_role(service.store, str(project_id), role_id,
                                         character_id=str(character_id))
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character role store unavailable") from exc


@router.post("/{character_id}/roles/{role_id}/source-search")
async def search_role_sources(project_id: UUID, character_id: UUID, role_id: str,
                              request: SourceQuestion,
                              authorization: str | None = Header(default=None)) -> dict:
    """Return cited excerpts from the latest release's complete approved source set."""
    _sources_enabled()
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, owner=True)
    await character(service.store, project_id, character_id)
    try:
        release = await load_published_role(service.store, str(project_id), role_id,
                                            character_id=str(character_id))
        sources = await load_approved_sources(service.store, str(project_id), release)
        excerpts = search_sources(sources, request.question)
    except (RoleProfileUnavailable, SourceUnavailable) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Source store unavailable") from exc
    return {"character_id": str(character_id), "role_id": role_id,
            "release_version": release["version"], "profile_hash": release["profile_hash"],
            "excerpts": excerpts, "answer_generated": False}


@router.post("/{character_id}/roles/{role_id}/voice-preview")
async def preview_voice(project_id: UUID, character_id: UUID, role_id: str,
                        request: Request, response: Response,
                        authorization: str | None = Header(default=None)) -> dict:
    """Start a voice-only rehearsal of an exact approved release, without action tools."""
    if os.getenv("AI_FILMS_CHARACTER_VOICE_PREVIEW_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Character voice preview is unavailable")
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor, owner=True)
    identity = await character(service.store, project_id, character_id)
    try:
        released = await load_published_role(service.store, str(project_id), role_id,
                                             character_id=str(character_id))
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Character release store unavailable") from exc

    voice_id = released["profile"]["voice_version"]
    approved = {value.strip() for value in os.getenv("AI_FILMS_APPROVED_ELEVENLABS_VOICES", "").split(",") if value.strip()}
    if not re.fullmatch(r"[A-Za-z0-9]{20,64}", voice_id) or voice_id not in approved:
        raise HTTPException(status_code=409, detail="Release voice is not approved for preview")
    if len(released["profile"]["introduction"]) > 500:
        raise HTTPException(status_code=409, detail="Release introduction is too long for voice preview")

    binding = {"project_id": str(project_id), "character_id": str(character_id),
               "role_id": role_id, "version": released["version"],
               "profile_hash": released["profile_hash"]}
    try:
        token, expires_at = issue_voice_session(actor, ttl_seconds=600, character_binding=binding)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Character voice preview service unavailable") from exc
    server_url = f"{_public_api_url(request)}/api/voice/vapi/webhook?{urlencode({'session': token})}"
    assistant = _inline_assistant(server_url)
    assistant["name"] = f"{identity['name']} · {role_id} preview"
    assistant["firstMessage"] = f"This is an AI character preview. {released['profile']['introduction']}"
    assistant["model"]["messages"] = [{"role": "system", "content": (
        f"You are an AI character preview for {identity['name']} in the {role_id} role. "
        "You may demonstrate the voice and introduction. Do not claim to have retrieved any "
        "approved source content or provide substantive instruction, advice, broadcasts, or support. "
        "If asked for source-specific answers or actions, explain that the grounded role agent is not connected in this preview."
    )}]
    assistant["model"]["tools"] = []
    assistant["voice"]["voiceId"] = voice_id
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    return {"mode": "character-voice-preview", "expires_at": expires_at,
            "character_id": str(character_id), "role_id": role_id,
            "release_version": released["version"], "assistant": assistant}
