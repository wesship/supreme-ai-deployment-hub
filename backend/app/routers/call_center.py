"""Governed multi-agent call-center control plane for D3VONN.IO voice."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/voice/call-center", tags=["voice-call-center"])


class HandoffRequest(BaseModel):
    call_id: str = Field(min_length=1, max_length=160)
    from_agent: str
    to_agent: str
    reason: str = Field(min_length=1, max_length=1000)
    customer_id: str | None = None
    intent: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    summary: str | None = Field(default=None, max_length=4000)


class LifecycleEvent(BaseModel):
    call_id: str = Field(min_length=1, max_length=160)
    event_type: str = Field(min_length=1, max_length=120)
    customer_id: str | None = None
    agent: str | None = None
    intent: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


AGENTS: dict[str, dict[str, Any]] = {
    "front_desk": {
        "name": "Front Desk / Router",
        "mission": "Identify caller, resolve intent, gather minimum context, and route safely.",
        "tools": ["lookup_customer", "get_customer_context", "search_knowledge", "transfer_to_agent", "transfer_to_human"],
        "write_authority": [],
    },
    "sales": {
        "name": "Sales Agent",
        "mission": "Qualify prospects, answer offer questions, and advance approved sales workflows.",
        "tools": ["lookup_customer", "search_knowledge", "create_lead", "update_lead", "create_crm_note", "get_available_slots", "transfer_to_human"],
        "write_authority": ["crm.lead", "crm.note"],
    },
    "support": {
        "name": "Support Agent",
        "mission": "Resolve support questions using governed knowledge and ticket workflows.",
        "tools": ["lookup_customer", "search_knowledge", "create_support_ticket", "get_ticket_status", "transfer_to_human"],
        "write_authority": ["support.ticket"],
    },
    "scheduling": {
        "name": "Scheduling Agent",
        "mission": "Read availability and perform confirmed appointment actions.",
        "tools": ["get_available_slots", "book_appointment", "reschedule_appointment", "cancel_appointment", "send_confirmation", "transfer_to_human"],
        "write_authority": ["calendar.event"],
    },
    "billing": {
        "name": "Billing Agent",
        "mission": "Answer billing and invoice questions without unrestricted financial authority.",
        "tools": ["lookup_customer", "get_invoice_status", "create_support_ticket", "transfer_to_human"],
        "write_authority": ["support.ticket"],
    },
    "retention": {
        "name": "Retention Agent",
        "mission": "Handle cancellation intent within approved save-offer and escalation policy.",
        "tools": ["lookup_customer", "get_customer_context", "create_crm_note", "transfer_to_human"],
        "write_authority": ["crm.note"],
    },
    "human_handoff": {
        "name": "Human Handoff Agent",
        "mission": "Package context and transfer the caller to a human without forcing repetition.",
        "tools": ["transfer_to_human", "create_crm_note"],
        "write_authority": ["crm.note"],
    },
}


def _configured(*names: str) -> bool:
    for name in names:
        value = os.getenv(name, "").strip()
        if value and not value.lower().startswith(("paste_", "change_me", "your_", "placeholder")):
            return True
    return False


def _validate_agent(name: str) -> None:
    if name not in AGENTS:
        raise HTTPException(status_code=422, detail=f"Unknown call-center agent: {name}")


@router.get("/agents")
async def list_agents() -> dict[str, Any]:
    return {
        "orchestration": {
            "realtime_owner": "vapi",
            "business_control_plane": "hermes",
            "async_automation": "n8n",
        },
        "agents": AGENTS,
        "count": len(AGENTS),
    }


@router.get("/health")
async def call_center_health() -> dict[str, Any]:
    providers = {
        "vapi": _configured("VAPI_PRIVATE_KEY", "VAPI_API_KEY"),
        "elevenlabs": _configured("ELEVENLABS_API_KEY"),
        "twilio": _configured("TWILIO_ACCOUNT_SID") and _configured("TWILIO_AUTH_TOKEN"),
        "hubspot": _configured("HUBSPOT_ACCESS_TOKEN", "HUBSPOT_PRIVATE_APP_TOKEN"),
        "google_calendar": _configured("GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CALENDAR_CREDENTIALS_JSON", "GOOGLE_CLIENT_ID"),
        "n8n": _configured("N8N_WEBHOOK_URL", "N8N_BASE_URL"),
        "hermes": True,
    }
    required_core = {key: providers[key] for key in ("vapi", "elevenlabs", "hermes")}
    return {
        "status": "configured" if all(required_core.values()) else "partial",
        "providers": providers,
        "agents_ready": len(AGENTS) == 7,
        "realtime_path": "Twilio -> Vapi -> specialist -> Hermes governed tool",
        "async_path": "Hermes event -> queue -> n8n",
        "secrets_exposed": False,
    }


@router.post("/handoff")
async def handoff(request: HandoffRequest) -> dict[str, Any]:
    _validate_agent(request.from_agent)
    _validate_agent(request.to_agent)
    if request.from_agent == request.to_agent:
        raise HTTPException(status_code=422, detail="Source and destination agents must differ")

    try:
        from backend.hermes.task_engine import log_event

        await log_event(
            event="voice.handoff.requested",
            message=f"Voice handoff {request.from_agent} -> {request.to_agent}",
            data=request.model_dump(),
            correlation_id=request.call_id,
        )
        recorded = True
    except Exception:
        recorded = False

    return {
        "status": "accepted",
        "call_id": request.call_id,
        "from_agent": request.from_agent,
        "to_agent": request.to_agent,
        "hermes_recorded": recorded,
        "handoff_packet": {
            "customer_id": request.customer_id,
            "intent": request.intent,
            "confidence": request.confidence,
            "summary": request.summary,
            "reason": request.reason,
        },
    }


@router.post("/events")
async def record_lifecycle_event(event: LifecycleEvent) -> dict[str, Any]:
    if event.agent is not None:
        _validate_agent(event.agent)

    try:
        from backend.hermes.task_engine import log_event

        await log_event(
            event=f"voice.call_center.{event.event_type}",
            message=f"Call-center lifecycle event: {event.event_type}",
            data=event.model_dump(),
            correlation_id=event.call_id,
        )
        recorded = True
    except Exception:
        recorded = False

    return {
        "ok": True,
        "call_id": event.call_id,
        "event_type": event.event_type,
        "hermes_recorded": recorded,
    }
