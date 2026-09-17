from __future__ import annotations

import hashlib
import logging
import re
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import create_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/client-ai", tags=["client-ai"])
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ClientAILeadIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    funnel_key: str = Field(default="default", min_length=1, max_length=80)
    client_key: str = Field(default="default", min_length=1, max_length=80)
    source: str = Field(default="landing-page", min_length=1, max_length=120)
    consent_to_contact: bool = False
    website: str = Field(default="", max_length=500)  # honeypot

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Enter a valid email address")
        return normalized

    @field_validator("funnel_key", "client_key", "source")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        return value.strip().lower()


class ClientAILeadOut(BaseModel):
    accepted: bool
    lead_id: str
    task_id: str | None = None
    next_step: str = "onboarding"


def _email_fingerprint(email: str) -> str:
    return hashlib.sha256(email.encode("utf-8")).hexdigest()


@router.post("/leads", response_model=ClientAILeadOut, status_code=status.HTTP_202_ACCEPTED)
async def create_client_ai_lead(payload: ClientAILeadIn) -> ClientAILeadOut:
    if payload.website:
        # Bots receive a neutral response; no data is persisted.
        return ClientAILeadOut(accepted=True, lead_id=str(uuid.uuid4()), next_step="onboarding")

    deps = get_dependencies()
    repository = deps.repository
    if not repository.configured:
        raise HTTPException(status_code=503, detail="Client AI intake is not configured")

    lead_id = str(uuid.uuid4())
    correlation_id = f"client-ai:{payload.client_key}:{lead_id}"
    lead_record: dict[str, Any] = {
        "id": lead_id,
        "client_key": payload.client_key,
        "funnel_key": payload.funnel_key,
        "email": payload.email,
        "email_fingerprint": _email_fingerprint(payload.email),
        "source": payload.source,
        "consent_to_contact": payload.consent_to_contact,
        "status": "new",
        "correlation_id": correlation_id,
        "metadata": {"intake_version": 1},
    }

    try:
        await repository.create_row("client_ai_leads", lead_record)
        task = await create_task(
            title=f"Qualify Client AI lead for {payload.client_key}",
            task_type="client_ai_lead_qualification",
            description="Qualify the new lead, determine the onboarding path, and prepare the first personalized follow-up.",
            agent_name="hermes",
            input_data={
                "lead_id": lead_id,
                "client_key": payload.client_key,
                "funnel_key": payload.funnel_key,
                "source": payload.source,
                "consent_to_contact": payload.consent_to_contact,
            },
            priority=4,
            source="client-ai-public-intake",
            correlation_id=correlation_id,
        )
    except Exception as exc:
        logger.exception("Failed to persist or dispatch Client AI lead")
        raise HTTPException(status_code=503, detail="Unable to accept intake right now") from exc

    return ClientAILeadOut(
        accepted=True,
        lead_id=lead_id,
        task_id=task.get("id"),
        next_step="onboarding",
    )
