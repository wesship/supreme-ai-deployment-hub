"""PRIMETIME Release 1 governed CRM API router.

This isolated router provides the first Release 1 API surface while keeping the
production app mount as a separate review step. It uses Supabase REST with fixed
table allow-lists, workspace membership checks, role gates, and audit events.
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

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release1"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

_ALLOWED_TABLES = frozenset({
    "workspaces",
    "roles",
    "workspace_memberships",
    "people",
    "households",
    "household_members",
    "pipeline_stages",
    "leads",
    "tasks",
    "activities",
    "consent_records",
    "suppression_records",
    "release_exceptions",
    "audit_events",
})

_TABLE_NAMES = {table: f"primetime_{table}" for table in _ALLOWED_TABLES}


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
ConsentState = Literal["unknown", "not_required", "granted", "revoked", "expired"]
LeadStatus = Literal["open", "closed", "converted", "not_ready"]

_WRITE_ROLES: set[str] = {"representative", "manager", "workspace_admin"}
_COMPLIANCE_ROLES: set[str] = {"compliance_reviewer", "manager", "workspace_admin"}
_ADMIN_ROLES: set[str] = {"workspace_admin"}


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


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")


class PersonCreate(BaseModel):
    workspace_id: str
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    source: str | None = Field(default=None, max_length=120)


class HouseholdCreate(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1, max_length=200)


class LeadCreate(BaseModel):
    workspace_id: str
    person_id: str | None = None
    owner_id: str
    pipeline_stage_id: str
    source: str = Field(min_length=1, max_length=120)
    status: LeadStatus = "open"
    consent_state: ConsentState = "unknown"
    next_action: str = Field(min_length=1, max_length=240)
    next_action_due_at: str


class TaskCreate(BaseModel):
    workspace_id: str
    lead_id: str | None = None
    owner_id: str
    title: str = Field(min_length=1, max_length=240)
    due_at: str | None = None
    priority: str = Field(default="normal", max_length=40)


class ActivityCreate(BaseModel):
    workspace_id: str
    lead_id: str | None = None
    person_id: str | None = None
    actor_id: str | None = None
    activity_type: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=2000)


class ConsentCreate(BaseModel):
    workspace_id: str
    person_id: str
    channel: Channel
    consent_state: ConsentState
    source: str = Field(min_length=1, max_length=160)
    evidence: dict[str, Any] = Field(default_factory=dict)


class SuppressionCreate(BaseModel):
    workspace_id: str
    person_id: str
    channel: Channel
    reason: str = Field(min_length=1, max_length=240)


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


@router.get("/workspaces")
async def list_workspaces(user_id: str = Depends(get_current_user_id)):
    safe_user = _validate_uuid(user_id, "user_id")
    memberships = await _query("workspace_memberships", {"select": "workspace_id,status", "user_id": f"eq.{safe_user}", "status": "eq.active"})
    ids = [row["workspace_id"] for row in memberships]
    if not ids:
        return []
    return await _query("workspaces", {"select": "*", "id": f"in.({','.join(ids)})", "order": "created_at.desc"})


@router.post("/workspaces")
async def create_workspace(body: WorkspaceCreate, user_id: str = Depends(get_current_user_id)):
    safe_user = _validate_uuid(user_id, "user_id")
    workspace = await _insert("workspaces", {"name": body.name, "slug": body.slug, "created_by": safe_user})
    roles = await _query("roles", {"select": "id", "code": "eq.workspace_admin", "limit": "1"})
    if not roles:
        raise HTTPException(status_code=503, detail="PRIMETIME workspace_admin role is not configured")
    await _insert(
        "workspace_memberships",
        {"workspace_id": workspace["id"], "user_id": safe_user, "role_id": roles[0]["id"], "status": "active"},
    )
    await _audit(workspace["id"], safe_user, "workspace.created", "workspace", workspace.get("id"))
    return workspace


@router.get("/people")
async def list_people(workspace_id: str = Query(...), q: str | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if q:
        params["or"] = f"(first_name.ilike.*{q}*,last_name.ilike.*{q}*,email.ilike.*{q}*,phone.ilike.*{q}*)"
    return await _query("people", params)


@router.post("/people")
async def create_person(body: PersonCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    record = await _insert("people", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "person.created", "person", record.get("id"))
    return record


@router.get("/people/duplicates")
async def find_duplicate_people(workspace_id: str = Query(...), email: str | None = None, phone: str | None = None, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    if not email and not phone:
        raise HTTPException(status_code=400, detail="email or phone is required")
    clauses = []
    if email:
        clauses.append(f"email.eq.{email}")
    if phone:
        clauses.append(f"phone.eq.{phone}")
    return await _query("people", {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "or": f"({','.join(clauses)})", "limit": "20"})


@router.get("/households")
async def list_households(workspace_id: str = Query(...), limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    return await _query("households", {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)})


@router.post("/households")
async def create_household(body: HouseholdCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    record = await _insert("households", {"workspace_id": context["workspace_id"], "name": body.name, "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "household.created", "household", record.get("id"))
    return record


@router.get("/pipeline-stages")
async def list_pipeline_stages(workspace_id: str = Query(...), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    return await _query("pipeline_stages", {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "position.asc"})


@router.get("/leads")
async def list_leads(workspace_id: str = Query(...), status: LeadStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "updated_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    return await _query("leads", params)


@router.post("/leads")
async def create_lead(body: LeadCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    record = await _insert("leads", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "lead.created", "lead", record.get("id"))
    return record


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: dict[str, Any], user_id: str = Depends(get_current_user_id)):
    safe_lead = _validate_uuid(lead_id, "lead_id")
    rows = await _query("leads", {"select": "id,workspace_id", "id": f"eq.{safe_lead}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Lead not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _WRITE_ROLES)
    forbidden = {"id", "workspace_id", "created_at", "created_by"}
    payload = {key: value for key, value in body.items() if key not in forbidden}
    updated = await _patch("leads", {"id": f"eq.{safe_lead}"}, payload)
    await _audit(context["workspace_id"], user_id, "lead.updated", "lead", safe_lead, {"fields": sorted(payload)})
    return updated


@router.post("/tasks")
async def create_task(body: TaskCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    record = await _insert("tasks", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "task.created", "task", record.get("id"))
    return record


@router.post("/activities")
async def create_activity(body: ActivityCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES | _COMPLIANCE_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "actor_id": body.actor_id or user_id}
    record = await _insert("activities", payload)
    await _audit(context["workspace_id"], user_id, "activity.created", "activity", record.get("id"))
    return record


@router.post("/consent-records")
async def create_consent_record(body: ConsentCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES | _COMPLIANCE_ROLES)
    record = await _insert("consent_records", {**body.model_dump(), "workspace_id": context["workspace_id"], "recorded_by": user_id})
    await _audit(context["workspace_id"], user_id, "consent.recorded", "consent_record", record.get("id"), {"channel": body.channel, "state": body.consent_state})
    return record


@router.post("/suppression-records")
async def create_suppression_record(body: SuppressionCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _COMPLIANCE_ROLES)
    record = await _insert("suppression_records", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "suppression.created", "suppression_record", record.get("id"), {"channel": body.channel})
    return record


@router.get("/exceptions")
async def list_release_exceptions(workspace_id: str = Query(...), status: str = Query("open"), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    return await _query("release_exceptions", {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "status": f"eq.{status}", "order": "created_at.desc"})


@router.get("/dashboard/daily")
async def representative_daily_dashboard(workspace_id: str = Query(...), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    leads = await _query("leads", {"select": "id,status,next_action,next_action_due_at", "workspace_id": f"eq.{context['workspace_id']}", "owner_id": f"eq.{user_id}", "status": "eq.open", "order": "next_action_due_at.asc", "limit": "50"})
    tasks = await _query("tasks", {"select": "id,title,status,due_at,priority", "workspace_id": f"eq.{context['workspace_id']}", "owner_id": f"eq.{user_id}", "status": "eq.open", "order": "due_at.asc", "limit": "50"})
    exceptions = await _query("release_exceptions", {"select": "id,entity_type,entity_id,rule_code,severity", "workspace_id": f"eq.{context['workspace_id']}", "status": "eq.open", "order": "created_at.desc", "limit": "50"})
    return {
        "workspaceId": context["workspace_id"],
        "userId": user_id,
        "role": context["role"],
        "openLeads": leads,
        "openTasks": tasks,
        "exceptions": exceptions,
        "summary": {
            "openLeadCount": len(leads),
            "openTaskCount": len(tasks),
            "exceptionCount": len(exceptions),
        },
    }
