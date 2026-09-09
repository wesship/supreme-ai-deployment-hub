from __future__ import annotations

import os
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.auth.supabase_jwt import OCCAccess

router = APIRouter(prefix="/moneyhub")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


class EconomicEventIn(BaseModel):
    kind: Literal["revenue", "cost"]
    agent_id: str
    provider: str = Field(min_length=1, max_length=80)
    provider_event_id: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    status: Literal["pending", "verified", "settled", "refunded", "disputed", "reversed"] = "verified"
    description: str | None = Field(default=None, max_length=1000)
    run_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a three-letter ISO code")
        return normalized


async def _record_event(principal: OCCAccess, payload: EconomicEventIn) -> dict[str, Any]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub economic ingestion is not configured.",
        )

    rpc_payload = {
        "p_kind": payload.kind,
        "p_user_id": principal.user_id,
        "p_agent_id": payload.agent_id,
        "p_provider": payload.provider,
        "p_provider_event_id": payload.provider_event_id,
        "p_source": payload.source,
        "p_amount": str(payload.amount),
        "p_currency": payload.currency,
        "p_status": payload.status,
        "p_description": payload.description,
        "p_run_id": payload.run_id,
        "p_metadata": payload.metadata,
        "p_occurred_at": payload.occurred_at.isoformat() if payload.occurred_at else None,
    }

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/moneyhub_record_economic_event",
                headers=headers,
                json=rpc_payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub ledger is unavailable.",
        ) from exc

    if response.status_code >= 400:
        detail = "MoneyHub economic event was rejected."
        try:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("message"), str):
                detail = body["message"]
        except ValueError:
            pass
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

    data = response.json()
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="MoneyHub ledger returned an invalid response.",
        )
    return data


@router.post("/economic-events", status_code=status.HTTP_201_CREATED)
async def record_economic_event(payload: EconomicEventIn, principal: OCCAccess) -> dict[str, Any]:
    result = await _record_event(principal, payload)
    return {
        "status": "recorded" if result.get("inserted") else "duplicate",
        "event": result,
    }
