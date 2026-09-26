from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.client_ai.auth import ClientAIUser
from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import create_task

router = APIRouter(prefix="/api/client-ai", tags=["client-ai"])


class ProfileInitializeIn(BaseModel):
    client_key: str = Field(default="default", min_length=1, max_length=80)
    display_name: str | None = Field(default=None, max_length=120)
    lead_id: str | None = None

    @field_validator("client_key")
    @classmethod
    def normalize_client_key(cls, value: str) -> str:
        return value.strip().lower()


class SourceRegisterIn(BaseModel):
    source_type: str
    title: str | None = Field(default=None, max_length=200)
    source_uri: str | None = Field(default=None, max_length=2000)
    consent_confirmed: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"voice", "document", "note", "image", "video", "website", "social", "conversation"}
        if normalized not in allowed:
            raise ValueError("Unsupported source type")
        return normalized


async def _owned_profile(profile_id: str, principal: ClientAIUser) -> dict[str, Any]:
    repo = get_dependencies().repository
    rows = await repo.list_rows(
        "client_ai_profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{principal.user_id}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Client AI profile not found")
    return rows[0]


@router.post("/profiles/initialize", status_code=status.HTTP_201_CREATED)
async def initialize_profile(payload: ProfileInitializeIn, principal: ClientAIUser):
    repo = get_dependencies().repository
    if not repo.configured:
        raise HTTPException(status_code=503, detail="Client AI onboarding is not configured")

    existing = await repo.list_rows(
        "client_ai_profiles",
        {
            "user_id": f"eq.{principal.user_id}",
            "client_key": f"eq.{payload.client_key}",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if existing:
        return {"profile": existing[0], "created": False}

    lead_id = payload.lead_id
    if lead_id:
        leads = await repo.list_rows("client_ai_leads", {"id": f"eq.{lead_id}", "limit": "1"})
        if not leads:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = leads[0]
        if not principal.email or lead.get("email") != principal.email:
            raise HTTPException(status_code=403, detail="Lead does not belong to this user")
        if lead.get("client_key") != payload.client_key:
            raise HTTPException(status_code=409, detail="Lead belongs to a different client workspace")

    profile_id = str(uuid.uuid4())
    correlation_id = f"client-ai-profile:{payload.client_key}:{profile_id}"
    profile = await repo.create_row(
        "client_ai_profiles",
        {
            "id": profile_id,
            "lead_id": lead_id,
            "user_id": principal.user_id,
            "client_key": payload.client_key,
            "display_name": payload.display_name,
            "profile_state": "draft",
            "consent_policy": {"source_ingestion_requires_confirmation": True},
            "metadata": {"onboarding_version": 1, "correlation_id": correlation_id},
        },
    )

    await create_task(
        title=f"Initialize Client AI profile for {payload.client_key}",
        task_type="client_ai_profile_initialization",
        description="Prepare the user's source-ingestion plan and profile scaffolding.",
        agent_name="hermes",
        input_data={"profile_id": profile_id, "client_key": payload.client_key, "user_id": principal.user_id},
        priority=4,
        source="client-ai-onboarding",
        correlation_id=correlation_id,
    )

    if lead_id:
        await repo.update_row("client_ai_leads", lead_id, {"status": "onboarding"})

    return {"profile": profile, "created": True}


@router.get("/profiles/me")
async def get_my_profile(client_key: str, principal: ClientAIUser):
    repo = get_dependencies().repository
    rows = await repo.list_rows(
        "client_ai_profiles",
        {
            "user_id": f"eq.{principal.user_id}",
            "client_key": f"eq.{client_key.strip().lower()}",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Client AI profile not found")
    return rows[0]


@router.post("/profiles/{profile_id}/sources", status_code=status.HTTP_202_ACCEPTED)
async def register_source(profile_id: str, payload: SourceRegisterIn, principal: ClientAIUser):
    if not payload.consent_confirmed:
        raise HTTPException(status_code=422, detail="Source ingestion requires explicit consent confirmation")

    repo = get_dependencies().repository
    profile = await _owned_profile(profile_id, principal)
    source_id = str(uuid.uuid4())
    correlation_id = f"client-ai-source:{profile_id}:{source_id}"

    source = await repo.create_row(
        "client_ai_sources",
        {
            "id": source_id,
            "profile_id": profile_id,
            "source_type": payload.source_type,
            "source_uri": payload.source_uri,
            "title": payload.title,
            "ingestion_status": "pending",
            "metadata": {
                **payload.metadata,
                "consent_confirmed": True,
                "registered_by_user_id": principal.user_id,
                "correlation_id": correlation_id,
            },
        },
    )

    task = await create_task(
        title=f"Ingest {payload.source_type} source into Client AI",
        task_type="client_ai_source_ingestion",
        description="Validate, ingest, classify, and index a consented source for this Client AI profile.",
        agent_name="hermes",
        input_data={
            "profile_id": profile_id,
            "source_id": source_id,
            "source_type": payload.source_type,
            "source_uri": payload.source_uri,
            "client_key": profile.get("client_key"),
        },
        priority=5,
        source="client-ai-onboarding",
        correlation_id=correlation_id,
    )

    await repo.update_row("client_ai_profiles", profile_id, {"profile_state": "training"})
    return {"source": source, "task_id": task.get("id"), "accepted": True}


@router.get("/profiles/{profile_id}/sources")
async def list_sources(profile_id: str, principal: ClientAIUser):
    await _owned_profile(profile_id, principal)
    repo = get_dependencies().repository
    return await repo.list_rows(
        "client_ai_sources",
        {"profile_id": f"eq.{profile_id}", "order": "created_at.desc", "limit": "100"},
    )
