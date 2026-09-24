"""Authenticated AI Films role authoring API; SQL enforces project membership."""
from __future__ import annotations

import os
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.ai_films.assembly_worker import AssemblyWorkerError, SupabaseAssemblyClient
from backend.ai_films.orchestration import OrchestrationError, SupabaseRLSClient
from backend.ai_films.role_authoring import RoleAuthoring
from backend.ai_films.role_policy_attestation import InvalidAttestation
from backend.ai_films.role_runtime import RoleProfileUnavailable
from backend.ai_films.router import _bearer_token

router = APIRouter(prefix="/ai-films/roles", tags=["ai-films-roles"])


class DraftRequest(BaseModel):
    expected_revision: int = Field(..., ge=0)
    profile: dict


class TransitionRequest(BaseModel):
    revision: int = Field(..., ge=1)


class TestRequest(TransitionRequest):
    attestation: str = Field(..., min_length=10, max_length=2048)


class Store(SupabaseAssemblyClient):
    async def role_rpc(self, payload: dict) -> dict:
        async with httpx.AsyncClient(headers=self.headers, timeout=30, transport=self._transport) as client:
            response = await client.post(f"{self.base_url}/rest/v1/rpc/ai_film_role_advance", json=payload)
        if response.status_code == 403:
            raise HTTPException(status_code=403, detail="Role transition denied")
        if response.status_code in (400, 404, 409):
            raise HTTPException(status_code=409, detail="Role state or revision conflict")
        if response.status_code >= 400:
            raise HTTPException(status_code=503, detail="Role authoring store unavailable")
        result = response.json()
        if not isinstance(result, dict):
            raise HTTPException(status_code=503, detail="Role authoring store returned invalid data")
        return result


async def _service(authorization: str | None) -> tuple[RoleAuthoring, str]:
    if os.getenv("AI_FILMS_ROLE_STUDIO_ENABLED", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=404, detail="Role Studio is unavailable")
    try:
        user = await SupabaseRLSClient(_bearer_token(authorization)).current_user()
    except OrchestrationError as exc:
        raise HTTPException(status_code=401, detail="Valid Supabase bearer token required") from exc
    try:
        return RoleAuthoring(Store()), user.id
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Role authoring store unavailable") from exc


async def _execute(action: str, project_id: UUID, role_id: str,
                   request: TransitionRequest, authorization: str | None) -> dict:
    service, actor_id = await _service(authorization)
    try:
        if action == "test":
            return await service.mark_tested(str(project_id), role_id, actor_id,
                                             request.revision, request.attestation)
        return await service.transition(action, str(project_id), role_id, actor_id, request.revision)
    except (InvalidAttestation, RoleProfileUnavailable) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AssemblyWorkerError as exc:
        raise HTTPException(status_code=503, detail="Role authoring store unavailable") from exc


@router.put("/{project_id}/{role_id}/draft")
async def save_draft(project_id: UUID, role_id: str, request: DraftRequest,
                     authorization: str | None = Header(default=None)) -> dict:
    service, actor_id = await _service(authorization)
    try:
        return await service.save(str(project_id), role_id, actor_id, request.expected_revision, request.profile)
    except RoleProfileUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{project_id}/{role_id}/test")
async def record_test(project_id: UUID, role_id: str, request: TestRequest,
                      authorization: str | None = Header(default=None)) -> dict:
    return await _execute("test", project_id, role_id, request, authorization)


@router.post("/{project_id}/{role_id}/submit-review")
async def submit_review(project_id: UUID, role_id: str, request: TransitionRequest,
                        authorization: str | None = Header(default=None)) -> dict:
    return await _execute("submit", project_id, role_id, request, authorization)


@router.post("/{project_id}/{role_id}/approve")
async def approve(project_id: UUID, role_id: str, request: TransitionRequest,
                  authorization: str | None = Header(default=None)) -> dict:
    return await _execute("approve", project_id, role_id, request, authorization)


@router.post("/{project_id}/{role_id}/publish")
async def publish(project_id: UUID, role_id: str, request: TransitionRequest,
                  authorization: str | None = Header(default=None)) -> dict:
    return await _execute("publish", project_id, role_id, request, authorization)
