"""Project-scoped character identities with independent role revisions and releases."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.ai_films.assembly_worker import AssemblyWorkerError
from backend.ai_films.role_authoring_router import DraftRequest, Store, TestRequest, TransitionRequest, _service
from backend.ai_films.role_policy_attestation import InvalidAttestation, issue_policy_attestation
from backend.ai_films.role_runtime import ROLE_TOOLS, RoleProfileUnavailable, load_published_role

router = APIRouter(prefix="/ai-films/projects/{project_id}/characters", tags=["ai-films-characters"])


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


@router.get("")
async def list_characters(project_id: UUID, authorization: str | None = Header(default=None)) -> list[dict]:
    service, actor = await _service(authorization)
    await access(service.store, project_id, actor)
    try:
        return await service.store._request("GET", "ai_film_characters", params={
            "project_id": f"eq.{project_id}", "status": "eq.active", "select": "id,name,slug,description,avatar_version,status",
            "order": "created_at.asc,id.asc", "limit": "1000"})
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
