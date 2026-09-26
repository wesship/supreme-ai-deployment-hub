"""Owner-scoped read endpoint for released AI Films avatar roles."""
from __future__ import annotations

import os
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.ai_films.assembly_worker import AssemblyWorkerError, SupabaseAssemblyClient
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.role_policy_attestation import InvalidAttestation, issue_policy_attestation
from backend.ai_films.role_runtime import RoleProfileUnavailable, load_published_role
from backend.ai_films.router import _bearer_token

router = APIRouter(prefix="/ai-films/roles", tags=["ai-films-roles"])


class PolicyCheckRequest(BaseModel):
    revision: int = Field(..., ge=1)
    profile: dict


async def _owner_db(project_id: UUID, authorization: str | None,
                    *, allow_editor: bool = False) -> SupabaseAssemblyClient:
    if os.getenv("AI_FILMS_ROLE_STUDIO_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Role Studio is unavailable")
    try:
        user = await SupabaseRLSClient(_bearer_token(authorization)).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc
    try:
        db = SupabaseAssemblyClient()
        projects = await db._request("GET", "ai_film_projects", params={
            "id": f"eq.{project_id}", "select": "owner_id", "limit": "1"})
        if len(projects) != 1:
            raise HTTPException(status_code=403, detail="AI Film project access required")
        if projects[0]["owner_id"] != user.id:
            if not allow_editor:
                raise HTTPException(status_code=403, detail="AI Film project owner access required")
            members = await db._request("GET", "ai_film_collaborators", params={
                "project_id": f"eq.{project_id}", "user_id": f"eq.{user.id}",
                "status": "eq.active", "role": "in.(producer,director,writer,editor)",
                "select": "id", "limit": "1"})
            if not members:
                raise HTTPException(status_code=403, detail="AI Film role editor access required")
        return db
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Role store unavailable") from exc


@router.get("/{project_id}/{role_id}/published")
async def get_published_role(project_id: UUID, role_id: str, authorization: str | None = Header(default=None)) -> dict:
    db = await _owner_db(project_id, authorization)
    try:
        return await load_published_role(db, str(project_id), role_id)
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Role store unavailable") from exc


@router.post("/{project_id}/{role_id}/policy-check")
async def policy_check_role(project_id: UUID, role_id: str, request: PolicyCheckRequest,
                            authorization: str | None = Header(default=None)) -> dict:
    await _owner_db(project_id, authorization, allow_editor=True)
    try:
        token = issue_policy_attestation(str(project_id), role_id, request.revision, request.profile)
    except (InvalidAttestation, RoleProfileUnavailable) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Role policy test unavailable") from exc
    return {"test_type": "policy_v1", "attestation": token, "expires_in_seconds": 600}
