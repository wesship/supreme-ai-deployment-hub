"""Governed multi-agent call-center control plane for D3VONN.IO voice."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.call_center_tools import TOOL_HANDLERS

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


class ToolInvocation(BaseModel):
    call_id: str = Field(min_length=1, max_length=160)
    agent: str
    parameters: dict[str, Any] = Field(default_factory=dict)


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


def _tool_schema(name: str) -> dict[str, Any]:
    schemas = {
        "lookup_customer": {
            "description": "Read one customer from the CRM by email or phone.",
            "parameters": {
                "type": "object",
                "properties": {"email": {"type": "string"}, "phone": {"type": "string"}},
            },
        },
        "get_customer_context": {
            "description": "Read minimal CRM context for a customer by email or phone.",
            "parameters": {
                "type": "object",
                "properties": {"email": {"type": "string"}, "phone": {"type": "string"}},
            },
        },
        "get_available_slots": {
            "description": "Read calendar busy intervals inside an ISO-8601 time window.",
            "parameters": {
                "type": "object",
                "properties": {"time_min": {"type": "string"}, "time_max": {"type": "string"}},
                "required": ["time_min", "time_max"],
            },
        },
        "book_appointment": {
            "description": "Create a calendar event only after explicit caller confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                    "summary": {"type": "string"},
                    "attendee_email": {"type": "string"},
                    "confirmed": {"type": "boolean"},
                },
                "required": ["start", "end", "confirmed"],
            },
        },
    }
    return schemas[name]


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


@router.get("/squad/manifest")
async def squad_manifest() -> dict[str, Any]:
    """Return a Vapi-ready squad definition without publishing it to Vapi."""
    members = []
    operational_tools = set(TOOL_HANDLERS)
    for key, agent in AGENTS.items():
        tools = []
        for tool_name in agent["tools"]:
            if tool_name in operational_tools:
                schema = _tool_schema(tool_name)
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": schema["description"],
                        "parameters": schema["parameters"],
                    },
                })
        members.append({
            "key": key,
            "assistant": {
                "name": f"D3VONN {agent['name']}",
                "model": {
                    "provider": "openai",
                    "model": os.getenv("VAPI_CALL_CENTER_MODEL", "gpt-4.1-mini"),
                    "messages": [{
                        "role": "system",
                        "content": (
                            f"You are the D3VONN.IO {agent['name']}. {agent['mission']} "
                            "Use only approved tools. Never invent provider results. "
                            "Before any write action, verify required confirmation and escalate when policy requires it."
                        ),
                    }],
                    "tools": tools,
                },
                "voice": {
                    "provider": "11labs",
                    "voiceId": os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")),
                    "model": os.getenv("ELEVENLABS_DEFAULT_MODEL", "eleven_turbo_v2_5"),
                },
            },
        })
    return {
        "name": "D3VONN Agentic Call Center",
        "members": members,
        "member_count": len(members),
        "published": False,
        "live_pstn_enabled": False,
        "note": "Manifest is generated locally; publishing to Vapi remains a separate certified deployment action.",
    }


@router.get("/health")
async def call_center_health() -> dict[str, Any]:
    providers = {
        "vapi": _configured("VAPI_PRIVATE_KEY", "VAPI_API_KEY"),
        "elevenlabs": _configured("ELEVENLABS_API_KEY"),
        "twilio": _configured("TWILIO_ACCOUNT_SID") and _configured("TWILIO_AUTH_TOKEN"),
        "hubspot": _configured("HUBSPOT_ACCESS_TOKEN", "HUBSPOT_PRIVATE_APP_TOKEN"),
        "google_calendar": _configured("GOOGLE_CALENDAR_ACCESS_TOKEN") and _configured("GOOGLE_CALENDAR_ID"),
        "n8n": _configured("N8N_WEBHOOK_URL", "N8N_BASE_URL"),
        "hermes": True,
    }
    required_core = {key: providers[key] for key in ("vapi", "elevenlabs", "hermes")}
    operational_tools = {
        "lookup_customer": providers["hubspot"],
        "get_customer_context": providers["hubspot"],
        "get_available_slots": providers["google_calendar"],
        "book_appointment": providers["google_calendar"],
    }
    return {
        "status": "configured" if all(required_core.values()) else "partial",
        "providers": providers,
        "agents_ready": len(AGENTS) == 7,
        "operational_tools": operational_tools,
        "tool_path_ready": all(operational_tools.values()),
        "realtime_path": "Twilio -> Vapi -> specialist -> Hermes governed tool",
        "async_path": "Hermes event -> queue -> n8n",
        "live_pstn_enabled": False,
        "secrets_exposed": False,
    }


@router.post("/tools/{tool_name}")
async def invoke_tool(tool_name: str, request: ToolInvocation) -> dict[str, Any]:
    _validate_agent(request.agent)
    if tool_name not in TOOL_HANDLERS:
        raise HTTPException(status_code=404, detail=f"Tool is not operational: {tool_name}")
    if tool_name not in AGENTS[request.agent]["tools"]:
        raise HTTPException(status_code=403, detail=f"Agent '{request.agent}' is not authorized for tool '{tool_name}'")

    try:
        from backend.hermes.task_engine import log_event
        await log_event(
            event="voice.call_center.tool.requested",
            message=f"Call-center tool request: {tool_name}",
            data={"call_id": request.call_id, "agent": request.agent, "tool": tool_name},
            correlation_id=request.call_id,
        )
    except Exception:
        pass

    result = await TOOL_HANDLERS[tool_name](request.parameters)

    try:
        from backend.hermes.task_engine import log_event
        await log_event(
            event="voice.call_center.tool.completed",
            message=f"Call-center tool completed: {tool_name}",
            data={
                "call_id": request.call_id,
                "agent": request.agent,
                "tool": tool_name,
                "status": result.get("status"),
            },
            correlation_id=request.call_id,
        )
    except Exception:
        pass

    return {"call_id": request.call_id, "agent": request.agent, "tool": tool_name, "result": result}


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
