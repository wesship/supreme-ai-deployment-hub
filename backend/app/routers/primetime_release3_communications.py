"""PRIMETIME Release 3 governed communications API router.

This router adds communication governance endpoints while preserving the
no-autonomous-send boundary. It provides templates, template versions,
preferences, communications, communication events, and policy-check records.
It does not expose delete endpoints or delivery/send endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone

import os
import re
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..middleware.auth import get_current_user_id

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release3-communications"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

_ALLOWED_TABLES = frozenset({
    "workspace_memberships",
    "roles",
    "message_templates",
    "message_template_versions",
    "communication_preferences",
    "communication_frequency_counters",
    "communications",
    "communication_events",
    "communication_policy_checks",
    "audit_events",
})

_TABLE_NAMES = {
    "workspace_memberships": "primetime_workspace_memberships",
    "roles": "primetime_roles",
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
Channel = Literal["sms", "email", "voice", "mail", "in_person"]
TemplateStatus = Literal["draft", "pending_review", "approved", "retired", "rejected"]
CommunicationStatus = Literal["draft", "pending_review", "approved", "scheduled", "blocked", "sent", "delivered", "failed", "responded", "opted_out"]
CommunicationDirection = Literal["outbound", "inbound"]
PolicyDecision = Literal["pass", "warn", "block", "review_required"]

_READ_ROLES: set[str] = {"representative", "trainee", "trainer", "manager", "compliance_reviewer", "workspace_admin", "auditor"}
_DRAFT_ROLES: set[str] = {"representative", "trainer", "manager", "workspace_admin", "compliance_reviewer"}
_APPROVAL_ROLES: set[str] = {"manager", "workspace_admin", "compliance_reviewer"}
_COMPLIANCE_ROLES: set[str] = {"compliance_reviewer", "manager", "workspace_admin"}


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


class MessageTemplateCreate(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1, max_length=160)
    purpose: str = Field(min_length=1, max_length=120)
    channel: Channel
    audience: str | None = Field(default=None, max_length=160)
    jurisdiction: str | None = Field(default=None, max_length=80)
    status: TemplateStatus = "draft"


class TemplateVersionCreate(BaseModel):
    workspace_id: str
    template_id: str
    version: int = Field(ge=1)
    subject: str | None = Field(default=None, max_length=240)
    body: str = Field(min_length=1, max_length=8000)
    disclosures: list[str] = Field(default_factory=list)
    allowed_variables: list[str] = Field(default_factory=list)
    status: TemplateStatus = "draft"
    effective_at: str | None = None
    expires_at: str | None = None


class TemplateApprovalPatch(BaseModel):
    status: TemplateStatus
    approved_at: str | None = None
    effective_at: str | None = None
    expires_at: str | None = None
    rejection_reason: str | None = Field(default=None, max_length=500)


class CommunicationPreferenceCreate(BaseModel):
    workspace_id: str
    person_id: str
    channel: Channel
    preference_state: str = Field(min_length=1, max_length=80)
    quiet_hours_start: str | None = Field(default=None, max_length=20)
    quiet_hours_end: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=80)
    max_frequency_per_day: int | None = Field(default=None, ge=0, le=100)


class CommunicationCreate(BaseModel):
    workspace_id: str
    person_id: str | None = None
    lead_id: str | None = None
    appointment_id: str | None = None
    template_id: str | None = None
    template_version_id: str | None = None
    channel: Channel
    direction: CommunicationDirection = "outbound"
    status: CommunicationStatus = "draft"
    subject: str | None = Field(default=None, max_length=240)
    body: str = Field(min_length=1, max_length=8000)
    scheduled_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommunicationPatch(BaseModel):
    status: CommunicationStatus | None = None
    template_id: str | None = None
    template_version_id: str | None = None
    subject: str | None = Field(default=None, max_length=240)
    body: str | None = Field(default=None, max_length=8000)
    scheduled_at: str | None = None
    blocked_reason: str | None = Field(default=None, max_length=500)
    metadata: dict[str, Any] | None = None


class CommunicationEventCreate(BaseModel):
    workspace_id: str
    communication_id: str
    event_type: str = Field(min_length=1, max_length=80)
    provider: str | None = Field(default=None, max_length=80)
    provider_event_id: str | None = Field(default=None, max_length=160)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PolicyCheckCreate(BaseModel):
    workspace_id: str
    communication_id: str | None = None
    template_id: str | None = None
    channel: Channel | None = None
    decision: PolicyDecision
    checks: dict[str, Any] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)


async def _membership_required(workspace_id: str, user_id: str) -> dict[str, Any]:
    safe_workspace = _validate_uuid(workspace_id, "workspace_id")
    safe_user = _validate_uuid(user_id, "user_id")
    rows = await _query(
        "workspace_memberships",
        {
            "select": "id,role_id,status,roles:primetime_roles(name)",
            "workspace_id": f"eq.{safe_workspace}",
            "user_id": f"eq.{safe_user}",
            "status": "eq.active",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=403, detail="Workspace access required")
    role = rows[0].get("roles") or {}
    return {"workspace_id": safe_workspace, "role": role.get("name", "representative")}


def _require_role(context: dict[str, Any], allowed: set[str]) -> None:
    if context.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient PRIMETIME role")


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


def _forbid_autonomous_send(status: CommunicationStatus | None) -> None:
    # Release 3 may draft, review, approve, schedule, and record externally delivered events.
    # It intentionally does not execute delivery or expose /send.
    if status in {"sent", "delivered"}:
        raise HTTPException(status_code=403, detail="Release 3 records delivery events but does not send communications")


def _filter_patch_payload(payload: dict[str, Any]) -> dict[str, Any]:
    forbidden = {"id", "workspace_id", "created_at", "created_by", "sent_at", "delivered_at"}
    return {key: value for key, value in payload.items() if key not in forbidden and value is not None}


@router.get("/message-templates")
async def list_message_templates(workspace_id: str = Query(...), channel: Channel | None = None, status: TemplateStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if channel:
        params["channel"] = f"eq.{channel}"
    if status:
        params["status"] = f"eq.{status}"
    return await _query("message_templates", params)


@router.post("/message-templates")
async def create_message_template(body: MessageTemplateCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _DRAFT_ROLES)
    if body.status == "approved":
        _require_role(context, _APPROVAL_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id}
    if body.status == "approved":
        payload.update({"approved_by": user_id, "approved_at": datetime.now(timezone.utc).isoformat()})
    record = await _insert("message_templates", payload)
    await _audit(context["workspace_id"], user_id, "message_template.created", "message_template", record.get("id"), {"channel": body.channel})
    return record


@router.patch("/message-templates/{template_id}")
async def update_message_template(template_id: str, body: TemplateApprovalPatch, user_id: str = Depends(get_current_user_id)):
    safe_template = _validate_uuid(template_id, "template_id")
    rows = await _query("message_templates", {"select": "id,workspace_id", "id": f"eq.{safe_template}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _APPROVAL_ROLES if body.status in {"approved", "rejected", "retired"} else _DRAFT_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    if body.status == "approved":
        payload["approved_by"] = user_id
        payload["approved_at"] = body.approved_at or datetime.now(timezone.utc).isoformat()
    updated = await _patch("message_templates", {"id": f"eq.{safe_template}"}, payload)
    await _audit(context["workspace_id"], user_id, "message_template.updated", "message_template", safe_template, {"status": body.status})
    return updated


@router.get("/message-template-versions")
async def list_message_template_versions(workspace_id: str = Query(...), template_id: str | None = None, status: TemplateStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "version.desc", "limit": str(limit)}
    if template_id:
        params["template_id"] = f"eq.{_validate_uuid(template_id, 'template_id')}"
    if status:
        params["status"] = f"eq.{status}"
    return await _query("message_template_versions", params)


@router.post("/message-template-versions")
async def create_message_template_version(body: TemplateVersionCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _APPROVAL_ROLES if body.status == "approved" else _DRAFT_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id}
    if body.status == "approved":
        payload["approved_by"] = user_id
        payload["approved_at"] = datetime.now(timezone.utc).isoformat()
    record = await _insert("message_template_versions", payload)
    await _audit(context["workspace_id"], user_id, "message_template_version.created", "message_template_version", record.get("id"), {"template_id": body.template_id})
    return record


@router.get("/communication-preferences")
async def list_communication_preferences(workspace_id: str = Query(...), person_id: str | None = None, channel: Channel | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "updated_at.desc", "limit": str(limit)}
    if person_id:
        params["person_id"] = f"eq.{_validate_uuid(person_id, 'person_id')}"
    if channel:
        params["channel"] = f"eq.{channel}"
    return await _query("communication_preferences", params)


@router.post("/communication-preferences")
async def create_communication_preference(body: CommunicationPreferenceCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    record = await _insert("communication_preferences", {**body.model_dump(), "workspace_id": context["workspace_id"], "updated_by": user_id})
    await _audit(context["workspace_id"], user_id, "communication_preference.created", "communication_preference", record.get("id"), {"channel": body.channel})
    return record


@router.get("/communications")
async def list_communications(workspace_id: str = Query(...), status: CommunicationStatus | None = None, channel: Channel | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    if channel:
        params["channel"] = f"eq.{channel}"
    return await _query("communications", params)


@router.post("/communications")
async def create_communication(body: CommunicationCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _DRAFT_ROLES)
    _forbid_autonomous_send(body.status)
    record = await _insert("communications", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "communication.created", "communication", record.get("id"), {"channel": body.channel, "status": body.status})
    return record


@router.patch("/communications/{communication_id}")
async def update_communication(communication_id: str, body: CommunicationPatch, user_id: str = Depends(get_current_user_id)):
    safe_communication = _validate_uuid(communication_id, "communication_id")
    rows = await _query("communications", {"select": "id,workspace_id,status", "id": f"eq.{safe_communication}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Communication not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _APPROVAL_ROLES if body.status in {"approved", "scheduled", "blocked"} else _DRAFT_ROLES)
    _forbid_autonomous_send(body.status)
    payload = _filter_patch_payload(body.model_dump())
    updated = await _patch("communications", {"id": f"eq.{safe_communication}"}, payload)
    await _audit(context["workspace_id"], user_id, "communication.updated", "communication", safe_communication, {"fields": sorted(payload)})
    return updated


@router.get("/communication-events")
async def list_communication_events(workspace_id: str = Query(...), communication_id: str | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if communication_id:
        params["communication_id"] = f"eq.{_validate_uuid(communication_id, 'communication_id')}"
    return await _query("communication_events", params)


@router.post("/communication-events")
async def create_communication_event(body: CommunicationEventCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _COMPLIANCE_ROLES | _DRAFT_ROLES)
    record = await _insert("communication_events", {**body.model_dump(), "workspace_id": context["workspace_id"], "recorded_by": user_id})
    await _audit(context["workspace_id"], user_id, "communication_event.created", "communication_event", record.get("id"), {"event_type": body.event_type})
    return record


@router.get("/communication-policy-checks")
async def list_communication_policy_checks(workspace_id: str = Query(...), communication_id: str | None = None, decision: PolicyDecision | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if communication_id:
        params["communication_id"] = f"eq.{_validate_uuid(communication_id, 'communication_id')}"
    if decision:
        params["decision"] = f"eq.{decision}"
    return await _query("communication_policy_checks", params)


@router.post("/communication-policy-checks")
async def create_communication_policy_check(body: PolicyCheckCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _COMPLIANCE_ROLES | _DRAFT_ROLES)
    record = await _insert("communication_policy_checks", {**body.model_dump(), "workspace_id": context["workspace_id"], "checked_by": user_id})
    await _audit(context["workspace_id"], user_id, "communication_policy_check.created", "communication_policy_check", record.get("id"), {"decision": body.decision})
    return record
