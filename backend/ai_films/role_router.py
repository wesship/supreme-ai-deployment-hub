"""Owner-scoped read endpoint for released AI Films avatar roles."""
from __future__ import annotations

import os
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from backend.ai_films.assembly_worker import AssemblyWorkerError, SupabaseAssemblyClient
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.role_runtime import RoleProfileUnavailable, load_published_role
from backend.ai_films.router import _bearer_token

router = APIRouter(prefix="/ai-films/roles", tags=["ai-films-roles"])


@router.get("/{project_id}/{role_id}/published")
async def get_published_role(project_id: UUID, role_id: str, authorization: str | None = Header(default=None)) -> dict:
    if os.getenv("AI_FILMS_ROLE_STUDIO_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Role Studio is unavailable")
    try:
        user = await SupabaseRLSClient(_bearer_token(authorization)).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc
    try:
        db = SupabaseAssemblyClient()
        projects = await db._request("GET", "ai_film_projects", params={
            "id": f"eq.{project_id}", "owner_id": f"eq.{user.id}", "select": "id", "limit": "1"})
        if len(projects) != 1:
            raise HTTPException(status_code=403, detail="AI Film project owner access required")
        return await load_published_role(db, str(project_id), role_id)
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Role store unavailable") from exc
