"""PRIMETIME Release 2 governed scheduling API router.

This router extends the governed PRIMETIME API surface with appointment,
availability, reminder, no-show, and calendar-sync boundary endpoints. It keeps
calendar integrations non-authoritative and preserves the no-delete rule for
regulated scheduling records.
"""
from __future__ import annotations

import os
import re
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..middleware.auth import get_current_user_id

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release2-scheduling"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

_ALLOWED_TABLES = frozenset({
    "workspace_memberships",
    "roles",
    "appointments",
    "appointment_attendees",
    "availability_rules",
    "reminders",
    "no_show_events",
    "calendar_sync_events",
    "activities",
    "audit_events",
})

_TABLE_NAMES = {
    "workspace_memberships": "primetime_workspace_memberships",
    "roles": "primetime_roles",
    "activities": "primetime_activities",
    "audit_events": "primetime_audit_events",
}


RoleName = Literal[
    "representative",
    "trainee",
    "trainer",
    "manager",
    "compliance_reviewer",
    "workspace_admin",
    "platform_admin",
    "auditor",
]
AppointmentStatus = Literal["scheduled", "confirmed", "completed", "cancelled", "rescheduled", "no_show"]
AppointmentType = Literal["intro", "needs_analysis", "application", "service", "training", "review", "other"]
ReminderChannel = Literal["sms", "email", "voice", "in_app"]
ReminderStatus = Literal["pending", "scheduled", "sent", "failed", "cancelled"]
CalendarProvider = Literal["google_calendar", "microsoft_calendar", "other"]

_WRITE_ROLES: set[str] = {"representative", "manager", "workspace_admin"}
_SCHEDULING_ROLES: set[str] = {"representative", "manager", "workspace_admin", "trainer"}
_COMPLIANCE_ROLES: set[str] = {"compliance_reviewer", "manager", "workspace_admin"}
_READ_ROLES: set[str] = _WRITE_ROLES | _COMPLIANCE_ROLES | {"trainee", "trainer", "auditor"}


def _validate_uuid(value: str, label: str = "id") -> str:
    if not _UUID_RE.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: must be a UUID")
    return value


def _get_supabase_base() -> str:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise HTTPException(status_code=503, detail="Supabase backend is not configured")
    parsed = urlparse(SUPABASE_URL)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not _ALLOWED_HOST_RE.match(host):
        raise HTTPException(status_code=503, detail="Invalid SUPABASE_URL host")
    return f"https://{host}"


def _headers(prefer: str = "return=representation") -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _path(table: str) -> str:
    if table not in _ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Unknown table: {table}")
    return f"/rest/v1/{_TABLE_NAMES.get(table, table)}"


async def _query(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{base}{_path(table)}", headers=_headers(), params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


async def _insert(table: str, payload: dict[str, Any], prefer: str = "return=representation") -> dict[str, Any]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{base}{_path(table)}", headers=_headers(prefer), json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json() if response.content else []
    return data[0] if data else payload


async def _patch(table: str, params: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(f"{base}{_path(table)}", headers=_headers(), params=params, json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json() if response.content else []
    return data[0] if data else payload


class AppointmentCreate(BaseModel):
    workspace_id: str
    owner_id: str
    lead_id: str | None = None
    household_id: str | None = None
    title: str = Field(min_length=1, max_length=240)
    appointment_type: AppointmentType = "other"
    status: AppointmentStatus = "scheduled"
    start_at: str
    end_at: str
    location_type: str = Field(default="virtual", max_length=40)
    location_value: str | None = Field(default=None, max_length=500)
    meeting_url: str | None = Field(default=None, max_length=1000)
    compliance_state: str = Field(default="pending", max_length=40)
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentAttendeeCreate(BaseModel):
    workspace_id: str
    appointment_id: str
    person_id: str | None = None
    user_id: str | None = None
    attendee_role: str = Field(default="participant", max_length=80)
    attendance_status: str = Field(default="invited", max_length=80)
    consent_checked_at: str | None = None


class AvailabilityRuleCreate(BaseModel):
    workspace_id: str
    user_id: str
    rule_name: str = Field(min_length=1, max_length=160)
    timezone: str = Field(default="UTC", max_length=80)
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    is_active: bool = True
    buffer_minutes: int = Field(default=15, ge=0, le=240)
    max_daily_appointments: int | None = Field(default=None, ge=1, le=100)


class ReminderCreate(BaseModel):
    workspace_id: str
    appointment_id: str
    recipient_person_id: str | None = None
    recipient_user_id: str | None = None
    channel: ReminderChannel
    scheduled_for: str
    status: ReminderStatus = "pending"
    template_key: str | None = Field(default=None, max_length=160)
    policy_check_state: str = Field(default="pending", max_length=40)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CalendarSyncEventCreate(BaseModel):
    workspace_id: str
    appointment_id: str
    provider: CalendarProvider
    external_calendar_id: str | None = Field(default=None, max_length=500)
    external_event_id: str | None = Field(default=None, max_length=500)
    direction: str = Field(default="outbound", max_length=40)
    status: str = Field(default="pending", max_length=80)
    request_payload: dict[str, Any] = Field(default_factory=dict)
    response_payload: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = Field(default=None, max_length=2000)


async def _membership_required(workspace_id: str, user_id: str) -> dict[str, Any]:
    safe_workspace = _validate_uuid(workspace_id, "workspace_id")
    safe_user = _validate_uuid(user_id, "user_id")
    rows = await _query(
        "workspace_memberships",
        {
            "select": "id,role_id,status,roles:primetime_roles(code)",
            "workspace_id": f"eq.{safe_workspace}",
            "user_id": f"eq.{safe_user}",
            "status": "eq.active",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=403, detail="Workspace access required")
    membership = rows[0]
    role = membership.get("roles") or {}
    return {"workspace_id": safe_workspace, "role": role.get("code", "representative")}


def _require_role(context: dict[str, Any], allowed: set[str]) -> None:
    if context.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient PRIMETIME scheduling role")


async def _audit(workspace_id: str, actor_id: str, action: str, entity_type: str, entity_id: str | None, metadata: dict[str, Any] | None = None) -> None:
    await _insert(
        "audit_events",
        {
            "workspace_id": workspace_id,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata or {},
        },
        prefer="return=minimal",
    )


async def _workspace_context(workspace_id: str, user_id: str) -> dict[str, Any]:
    return await _membership_required(workspace_id, user_id)


async def _load_appointment(appointment_id: str) -> dict[str, Any]:
    safe_appointment = _validate_uuid(appointment_id, "appointment_id")
    rows = await _query("appointments", {"select": "id,workspace_id,status", "id": f"eq.{safe_appointment}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return rows[0]


@router.get("/appointments")
async def list_appointments(workspace_id: str = Query(...), status: AppointmentStatus | None = None, start_from: str | None = None, start_to: str | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "start_at.asc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    if start_from:
        params["start_at"] = f"gte.{start_from}"
    if start_to:
        params["end_at"] = f"lte.{start_to}"
    return await _query("appointments", params)


@router.post("/appointments")
async def create_appointment(body: AppointmentCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _SCHEDULING_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id}
    record = await _insert("appointments", payload)
    await _audit(context["workspace_id"], user_id, "appointment.created", "appointment", record.get("id"), {"status": body.status, "type": body.appointment_type})
    return record


@router.patch("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, body: dict[str, Any], user_id: str = Depends(get_current_user_id)):
    appointment = await _load_appointment(appointment_id)
    context = await _workspace_context(appointment["workspace_id"], user_id)
    _require_role(context, _SCHEDULING_ROLES)
    forbidden = {"id", "workspace_id", "created_at", "created_by"}
    payload = {key: value for key, value in body.items() if key not in forbidden}
    if not payload:
        raise HTTPException(status_code=400, detail="No updateable appointment fields supplied")
    updated = await _patch("appointments", {"id": f"eq.{appointment['id']}"}, payload)
    await _audit(context["workspace_id"], user_id, "appointment.updated", "appointment", appointment["id"], {"fields": sorted(payload)})
    return updated


@router.get("/availability-rules")
async def list_availability_rules(workspace_id: str = Query(...), user_filter: str | None = Query(default=None, alias="user_id"), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "is_active": "eq.true", "order": "day_of_week.asc,start_time.asc"}
    if user_filter:
        params["user_id"] = f"eq.{_validate_uuid(user_filter, 'user_id')}"
    return await _query("availability_rules", params)


@router.post("/availability-rules")
async def create_availability_rule(body: AvailabilityRuleCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _SCHEDULING_ROLES)
    record = await _insert("availability_rules", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "availability_rule.created", "availability_rule", record.get("id"))
    return record


@router.post("/appointment-attendees")
async def create_appointment_attendee(body: AppointmentAttendeeCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _SCHEDULING_ROLES)
    _validate_uuid(body.appointment_id, "appointment_id")
    record = await _insert("appointment_attendees", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "appointment_attendee.created", "appointment_attendee", record.get("id"), {"appointment_id": body.appointment_id})
    return record


@router.get("/reminders")
async def list_reminders(workspace_id: str = Query(...), status: ReminderStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "scheduled_for.asc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    return await _query("reminders", params)


@router.post("/reminders")
async def create_reminder(body: ReminderCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _SCHEDULING_ROLES)
    record = await _insert("reminders", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "reminder.created", "reminder", record.get("id"), {"channel": body.channel, "status": body.status})
    return record


@router.get("/no-show-events")
async def list_no_show_events(workspace_id: str = Query(...), limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    return await _query("no_show_events", {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)})


@router.post("/calendar-sync-events")
async def create_calendar_sync_event(body: CalendarSyncEventCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _SCHEDULING_ROLES | _COMPLIANCE_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id}
    record = await _insert("calendar_sync_events", payload)
    await _audit(
        context["workspace_id"],
        user_id,
        "calendar_sync_event.created",
        "calendar_sync_event",
        record.get("id"),
        {"provider": body.provider, "direction": body.direction, "authoritative": False},
    )
    return record
