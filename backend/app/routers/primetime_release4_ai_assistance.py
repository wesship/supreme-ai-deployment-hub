"""PRIMETIME Release 4 governed AI Assistance API router.

Draft-first AI assistance API. No autonomous send, quote, policy
recommendation, application submission, execution, or delete endpoints.
The AI layer does not execute actions autonomously — all regulated actions require human approval.
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

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release4-ai-assistance"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_ALLOWED_TABLES = frozenset({
    "workspace_memberships", "roles", "ai_agents", "ai_agent_versions",
    "ai_assistance_requests", "ai_assistance_outputs", "ai_action_ledger",
    "ai_approval_requests", "ai_compliance_findings", "ai_knowledge_citations",
    "audit_events",
})

_TABLE_NAMES = {
    "workspace_memberships": "primetime_workspace_memberships",
    "roles": "primetime_roles",
    "audit_events": "primetime_audit_events",
}


AgentKey = Literal["intake_agent", "follow_up_agent", "scheduling_agent", "meeting_prep_agent", "compliance_reviewer_agent"]
AgentStatus = Literal["draft", "pending_review", "approved", "retired", "disabled"]
RequestStatus = Literal["requested", "processing", "draft_ready", "review_required", "blocked", "approved", "rejected", "closed"]
OutputStatus = Literal["draft", "review_required", "approved", "rejected", "superseded", "blocked"]
OutputCreateStatus = Literal["draft", "review_required", "blocked"]
ActionType = Literal["create_task", "draft_message", "suggest_next_action", "prepare_meeting_brief", "check_compliance", "schedule_appointment_draft", "regulated_recommendation", "quote_generation", "policy_decision", "submit_application", "send_message", "voice_call", "delete_record"]
ActionStatus = Literal["proposed", "blocked", "approval_required", "approved", "executed", "rejected", "failed"]
ActionCreateStatus = Literal["proposed", "blocked", "approval_required"]
ApprovalStatus = Literal["pending", "approved", "rejected", "expired", "cancelled"]
ApprovalCreateStatus = Literal["pending"]
ReviewType = Literal["human", "licensed", "compliance", "manager"]
FindingSeverity = Literal["info", "warning", "critical", "blocked"]

_READ_ROLES = {"representative", "trainee", "trainer", "manager", "compliance_reviewer", "workspace_admin", "auditor"}
_DRAFT_ROLES = {"representative", "trainer", "manager", "workspace_admin", "compliance_reviewer"}
_APPROVAL_ROLES = {"manager", "workspace_admin", "compliance_reviewer"}
_COMPLIANCE_ROLES = {"compliance_reviewer", "manager", "workspace_admin"}
_ADMIN_ROLES = {"workspace_admin", "platform_admin"}
_BLOCKED_ACTION_TYPES = {"regulated_recommendation", "quote_generation", "policy_decision", "submit_application", "send_message", "voice_call", "delete_record"}


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
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json", "Prefer": prefer}


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


class AiAgentCreate(BaseModel):
    workspace_id: str
    key: AgentKey
    name: str = Field(min_length=1, max_length=160)
    purpose: str = Field(min_length=1, max_length=500)
    status: AgentStatus = "draft"
    allowed_actions: list[str] = Field(default_factory=list)
    blocked_actions: list[str] = Field(default_factory=lambda: sorted(_BLOCKED_ACTION_TYPES))


class AiAgentPatch(BaseModel):
    name: str | None = None
    purpose: str | None = None
    status: AgentStatus | None = None
    allowed_actions: list[str] | None = None
    blocked_actions: list[str] | None = None


class AiAgentVersionCreate(BaseModel):
    workspace_id: str
    agent_id: str
    version: int = Field(ge=1)
    system_prompt: str = Field(min_length=1, max_length=12000)
    model_policy: dict[str, Any] = Field(default_factory=dict)
    tool_policy: dict[str, Any] = Field(default_factory=dict)
    status: AgentStatus = "draft"


class AiAgentVersionPatch(BaseModel):
    status: AgentStatus | None = None
    approved_at: str | None = None
    system_prompt: str | None = None
    model_policy: dict[str, Any] | None = None
    tool_policy: dict[str, Any] | None = None


class AssistanceRequestCreate(BaseModel):
    workspace_id: str
    agent_key: AgentKey
    request_type: str = Field(min_length=1, max_length=120)
    prompt: str = Field(min_length=1, max_length=8000)
    status: RequestStatus = "requested"
    person_id: str | None = None
    lead_id: str | None = None
    appointment_id: str | None = None
    communication_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class AssistanceRequestPatch(BaseModel):
    status: RequestStatus | None = None
    assigned_agent_version_id: str | None = None
    context: dict[str, Any] | None = None


class AssistanceOutputCreate(BaseModel):
    workspace_id: str
    request_id: str
    output_type: str = Field(min_length=1, max_length=120)
    content: dict[str, Any] = Field(default_factory=dict)
    status: OutputCreateStatus = "draft"
    agent_id: str | None = None
    agent_version_id: str | None = None
    requires_human_approval: bool = True
    requires_licensed_review: bool = False
    requires_compliance_review: bool = False


class AssistanceOutputPatch(BaseModel):
    status: OutputStatus | None = None
    content: dict[str, Any] | None = None
    requires_human_approval: bool | None = None
    requires_licensed_review: bool | None = None
    requires_compliance_review: bool | None = None


class ActionLedgerCreate(BaseModel):
    workspace_id: str
    action_type: ActionType
    action_status: ActionCreateStatus = "proposed"
    request_id: str | None = None
    output_id: str | None = None
    target_table: str | None = None
    target_id: str | None = None
    proposed_payload: dict[str, Any] = Field(default_factory=dict)
    risk_flags: list[str] = Field(default_factory=list)


class ApprovalRequestCreate(BaseModel):
    workspace_id: str
    review_type: ReviewType
    status: ApprovalCreateStatus = "pending"
    action_id: str | None = None
    output_id: str | None = None
    reason: str | None = None
    due_at: str | None = None


class ApprovalRequestPatch(BaseModel):
    status: ApprovalStatus
    decision_reason: str | None = None
    decided_at: str | None = None


class ComplianceFindingCreate(BaseModel):
    workspace_id: str
    severity: FindingSeverity
    rule_key: str = Field(min_length=1, max_length=160)
    finding: str = Field(min_length=1, max_length=1000)
    request_id: str | None = None
    output_id: str | None = None
    action_id: str | None = None
    recommendation: str | None = None
    status: str = "open"


class ComplianceFindingPatch(BaseModel):
    status: str
    resolution_note: str | None = None
    resolved_at: str | None = None


class KnowledgeCitationCreate(BaseModel):
    workspace_id: str
    output_id: str
    source_title: str = Field(min_length=1, max_length=240)
    source_type: str = Field(min_length=1, max_length=120)
    confidence: float = Field(ge=0, le=1)
    source_url: str | None = None
    source_version: str | None = None
    effective_date: str | None = None
    excerpt: str | None = None


async def _workspace_context(workspace_id: str, user_id: str) -> dict[str, Any]:
    safe_workspace = _validate_uuid(workspace_id, "workspace_id")
    safe_user = _validate_uuid(user_id, "user_id")
    rows = await _query("workspace_memberships", {"select": "id,role_id,status,roles:primetime_roles(code)", "workspace_id": f"eq.{safe_workspace}", "user_id": f"eq.{safe_user}", "status": "eq.active", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=403, detail="Workspace access required")
    role = rows[0].get("roles") or {}
    return {"workspace_id": safe_workspace, "role": role.get("code", "representative")}


def _require_role(context: dict[str, Any], allowed: set[str]) -> None:
    if context.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient PRIMETIME role")


async def _audit(workspace_id: str, actor_id: str, action: str, entity_type: str, entity_id: str | None, metadata: dict[str, Any] | None = None) -> None:
    await _insert("audit_events", {"workspace_id": workspace_id, "actor_id": actor_id, "action": action, "entity_type": entity_type, "entity_id": entity_id, "metadata": metadata or {}}, prefer="return=minimal")


def _clean(payload: dict[str, Any]) -> dict[str, Any]:
    forbidden = {"id", "workspace_id", "created_at", "created_by", "requested_by", "recorded_by", "approved_by", "executed_at"}
    return {k: v for k, v in payload.items() if k not in forbidden and v is not None}


def _forbid_regulated_action(action_type: ActionType, status: ActionStatus | None = None) -> None:
    if action_type in _BLOCKED_ACTION_TYPES and status != "blocked":
        raise HTTPException(status_code=403, detail=f"Release 4 blocks autonomous regulated action: {action_type}")
    if status not in {None, "proposed", "blocked", "approval_required"}:
        raise HTTPException(status_code=400, detail="Release 4 action creation accepts proposals only; decisions require an approval-request review")


def _id_filter(value: str, label: str) -> str:
    return f"eq.{_validate_uuid(value, label)}"


async def _get_context_for_record(table: str, record_id: str, user_id: str, label: str) -> tuple[str, dict[str, Any]]:
    safe_id = _validate_uuid(record_id, label)
    rows = await _query(table, {"select": "id,workspace_id", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return safe_id, await _workspace_context(rows[0]["workspace_id"], user_id)


@router.get("/ai-agents")
async def list_ai_agents(workspace_id: str = Query(...), status: AgentStatus | None = None, key: AgentKey | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "name.asc", "limit": str(limit)}
    if status: params["status"] = f"eq.{status}"
    if key: params["key"] = f"eq.{key}"
    return await _query("ai_agents", params)


@router.post("/ai-agents")
async def create_ai_agent(body: AiAgentCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _ADMIN_ROLES if body.status != "approved" else _APPROVAL_ROLES)
    record = await _insert("ai_agents", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_agent.created", "ai_agent", record.get("id"), {"key": body.key}); return record


@router.patch("/ai-agents/{agent_id}")
async def update_ai_agent(agent_id: str, body: AiAgentPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_agents", agent_id, user_id, "agent_id"); _require_role(context, _ADMIN_ROLES if body.status != "approved" else _APPROVAL_ROLES)
    payload = _clean(body.model_dump()); updated = await _patch("ai_agents", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "ai_agent.updated", "ai_agent", safe_id, {"fields": sorted(payload)}); return updated


@router.get("/ai-agent-versions")
async def list_ai_agent_versions(workspace_id: str = Query(...), agent_id: str | None = None, status: AgentStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "version.desc", "limit": str(limit)}
    if agent_id: params["agent_id"] = _id_filter(agent_id, "agent_id")
    if status: params["status"] = f"eq.{status}"
    return await _query("ai_agent_versions", params)


@router.post("/ai-agent-versions")
async def create_ai_agent_version(body: AiAgentVersionCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _ADMIN_ROLES if body.status != "approved" else _APPROVAL_ROLES)
    payload = {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id}
    if body.status == "approved":
        payload["approved_by"] = user_id
        payload["approved_at"] = datetime.now(timezone.utc).isoformat()
    record = await _insert("ai_agent_versions", payload); await _audit(context["workspace_id"], user_id, "ai_agent_version.created", "ai_agent_version", record.get("id"), {"agent_id": body.agent_id}); return record


@router.patch("/ai-agent-versions/{version_id}")
async def update_ai_agent_version(version_id: str, body: AiAgentVersionPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_agent_versions", version_id, user_id, "version_id"); _require_role(context, _APPROVAL_ROLES if body.status == "approved" else _ADMIN_ROLES)
    payload = _clean(body.model_dump())
    if body.status == "approved":
        payload["approved_by"] = user_id
        payload["approved_at"] = body.approved_at or datetime.now(timezone.utc).isoformat()
    updated = await _patch("ai_agent_versions", {"id": f"eq.{safe_id}"}, payload); await _audit(context["workspace_id"], user_id, "ai_agent_version.updated", "ai_agent_version", safe_id, {"fields": sorted(payload)}); return updated


@router.get("/ai-assistance-requests")
async def list_ai_assistance_requests(workspace_id: str = Query(...), status: RequestStatus | None = None, agent_key: AgentKey | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if status: params["status"] = f"eq.{status}"
    if agent_key: params["agent_key"] = f"eq.{agent_key}"
    return await _query("ai_assistance_requests", params)


@router.post("/ai-assistance-requests")
async def create_ai_assistance_request(body: AssistanceRequestCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _DRAFT_ROLES)
    record = await _insert("ai_assistance_requests", {**body.model_dump(), "workspace_id": context["workspace_id"], "requested_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_assistance_request.created", "ai_assistance_request", record.get("id"), {"agent_key": body.agent_key}); return record


@router.patch("/ai-assistance-requests/{request_id}")
async def update_ai_assistance_request(request_id: str, body: AssistanceRequestPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_assistance_requests", request_id, user_id, "request_id"); _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    payload = _clean(body.model_dump()); updated = await _patch("ai_assistance_requests", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "ai_assistance_request.updated", "ai_assistance_request", safe_id, {"fields": sorted(payload)}); return updated


@router.get("/ai-assistance-outputs")
async def list_ai_assistance_outputs(workspace_id: str = Query(...), request_id: str | None = None, status: OutputStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if request_id: params["request_id"] = _id_filter(request_id, "request_id")
    if status: params["status"] = f"eq.{status}"
    return await _query("ai_assistance_outputs", params)


@router.post("/ai-assistance-outputs")
async def create_ai_assistance_output(body: AssistanceOutputCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    if body.status not in {"draft", "review_required", "blocked"}:
        raise HTTPException(status_code=400, detail="Release 4 output creation accepts drafts only; decisions require an approval-request review")
    record = await _insert("ai_assistance_outputs", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_assistance_output.created", "ai_assistance_output", record.get("id"), {"status": body.status}); return record


@router.patch("/ai-assistance-outputs/{output_id}")
async def update_ai_assistance_output(output_id: str, body: AssistanceOutputPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_assistance_outputs", output_id, user_id, "output_id"); _require_role(context, _APPROVAL_ROLES if body.status in {"approved", "rejected"} else (_DRAFT_ROLES | _COMPLIANCE_ROLES))
    payload = _clean(body.model_dump()); updated = await _patch("ai_assistance_outputs", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "ai_assistance_output.updated", "ai_assistance_output", safe_id, {"fields": sorted(payload)}); return updated


@router.get("/ai-action-ledger")
async def list_ai_action_ledger(workspace_id: str = Query(...), action_status: ActionStatus | None = None, action_type: ActionType | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if action_status: params["action_status"] = f"eq.{action_status}"
    if action_type: params["action_type"] = f"eq.{action_type}"
    return await _query("ai_action_ledger", params)


@router.post("/ai-action-ledger")
async def create_ai_action_ledger(body: ActionLedgerCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    _forbid_regulated_action(body.action_type, body.action_status)
    record = await _insert("ai_action_ledger", {**body.model_dump(), "workspace_id": context["workspace_id"], "proposed_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_action.proposed", "ai_action", record.get("id"), {"action_type": body.action_type, "status": body.action_status}); return record


@router.get("/ai-approval-requests")
async def list_ai_approval_requests(workspace_id: str = Query(...), status: ApprovalStatus | None = None, review_type: ReviewType | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if status: params["status"] = f"eq.{status}"
    if review_type: params["review_type"] = f"eq.{review_type}"
    return await _query("ai_approval_requests", params)


@router.post("/ai-approval-requests")
async def create_ai_approval_request(body: ApprovalRequestCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    record = await _insert("ai_approval_requests", {**body.model_dump(), "workspace_id": context["workspace_id"], "requested_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_approval_request.created", "ai_approval_request", record.get("id"), {"review_type": body.review_type}); return record


@router.patch("/ai-approval-requests/{approval_id}")
async def update_ai_approval_request(approval_id: str, body: ApprovalRequestPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_approval_requests", approval_id, user_id, "approval_id"); _require_role(context, _COMPLIANCE_ROLES if body.status in {"approved", "rejected"} else _APPROVAL_ROLES)
    payload = _clean(body.model_dump()); payload["decided_by"] = user_id
    updated = await _patch("ai_approval_requests", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "ai_approval_request.updated", "ai_approval_request", safe_id, {"status": body.status}); return updated


@router.get("/ai-compliance-findings")
async def list_ai_compliance_findings(workspace_id: str = Query(...), severity: FindingSeverity | None = None, status: str | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if severity: params["severity"] = f"eq.{severity}"
    if status: params["status"] = f"eq.{status}"
    return await _query("ai_compliance_findings", params)


@router.post("/ai-compliance-findings")
async def create_ai_compliance_finding(body: ComplianceFindingCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _COMPLIANCE_ROLES | _DRAFT_ROLES)
    record = await _insert("ai_compliance_findings", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_compliance_finding.created", "ai_compliance_finding", record.get("id"), {"severity": body.severity, "rule_key": body.rule_key}); return record


@router.patch("/ai-compliance-findings/{finding_id}")
async def update_ai_compliance_finding(finding_id: str, body: ComplianceFindingPatch, user_id: str = Depends(get_current_user_id)):
    safe_id, context = await _get_context_for_record("ai_compliance_findings", finding_id, user_id, "finding_id"); _require_role(context, _COMPLIANCE_ROLES)
    payload = _clean(body.model_dump()); payload["resolved_by"] = user_id
    updated = await _patch("ai_compliance_findings", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "ai_compliance_finding.updated", "ai_compliance_finding", safe_id, {"status": body.status}); return updated


@router.get("/ai-knowledge-citations")
async def list_ai_knowledge_citations(workspace_id: str = Query(...), output_id: str | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id); _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if output_id: params["output_id"] = _id_filter(output_id, "output_id")
    return await _query("ai_knowledge_citations", params)


@router.post("/ai-knowledge-citations")
async def create_ai_knowledge_citation(body: KnowledgeCitationCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id); _require_role(context, _DRAFT_ROLES | _COMPLIANCE_ROLES)
    record = await _insert("ai_knowledge_citations", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "ai_knowledge_citation.created", "ai_knowledge_citation", record.get("id"), {"source_title": body.source_title, "confidence": body.confidence}); return record
