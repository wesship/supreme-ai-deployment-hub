"""Lead enrichment API aliases for Hermes Research OS."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from .agents import LeadEnrichmentAgent
from .models import LeadCandidate

router = APIRouter(prefix="/api/leads", tags=["research-os-leads"])
lead_agent = LeadEnrichmentAgent()


class ClayWebhookPayload(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.post("/enrich")
async def enrich_leads(leads: list[LeadCandidate]):
    """Queue lead candidates into Clay when CLAY_WEBHOOK_URL is configured."""
    return await lead_agent.enrich(leads)


@router.post("/clay-webhook")
async def receive_clay_webhook(payload: ClayWebhookPayload):
    """Receive Clay webhook callbacks and optionally persist them to Supabase.

    This gives Clay a stable callback URL after it enriches records. Set
    CLAY_CALLBACK_TABLE to override the default clay_lead_queue target table.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    table = os.getenv("CLAY_CALLBACK_TABLE", "clay_lead_queue")
    if not url or not key:
        return {"status": "received", "saved": 0, "message": "Supabase not configured; callback accepted only."}

    rows = []
    for record in payload.records:
        rows.append(
            {
                "company": record.get("company") or record.get("Company"),
                "person": record.get("person") or record.get("Name") or record.get("full_name"),
                "role": record.get("role") or record.get("Title") or record.get("job_title"),
                "website": record.get("website") or record.get("domain"),
                "linkedin_url": record.get("linkedin_url") or record.get("linkedin"),
                "source_url": record.get("source_url"),
                "confidence": record.get("confidence") or 0,
                "metadata": {"source": payload.source, "payload_metadata": payload.metadata, "record": record},
                "status": "enriched",
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    if not rows:
        return {"status": "received", "saved": 0, "message": "No records in callback."}

    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{url.rstrip('/')}/rest/v1/{table}", headers=headers, json=rows)
        resp.raise_for_status()

    return {"status": "saved", "saved": len(rows)}
