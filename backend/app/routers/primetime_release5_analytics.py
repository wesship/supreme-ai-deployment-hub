"""PRIMETIME Release 5 Analytics and Executive Command Center API router.

This router exposes governed analytics and dashboard endpoints for PRIMETIME.
Release 5 is observation-only: it records definitions, dashboard configuration,
snapshots, and release governance observations. It does not mutate CRM,
scheduling, communication, AI-assistance, policy, quote, or delivery records.
It intentionally exposes no DELETE endpoints and no autonomous execution routes.
"""
from __future__ import annotations

import os
import re
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from ..middleware.auth import get_current_user_id

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release5-analytics"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

_ALLOWED_TABLES = frozenset({
    "workspace_memberships",
    "roles",
    "analytics_metric_definitions",
    "executive_dashboards",
    "dashboard_widgets",
    "analytics_snapshots",
    "funnel_stage_snapshots",
    "agent_performance_snapshots",
    "compliance_metric_snapshots",
    "ai_action_metric_snapshots",
    "release_governance_observations",
    "audit_events",
})
_MUTATION_TABLES = frozenset({
    "analytics_metric_definitions",
    "executive_dashboards",
    "dashboard_widgets",
    "analytics_snapshots",
    "funnel_stage_snapshots",
    "agent_performance_snapshots",
    "compliance_metric_snapshots",
    "ai_action_metric_snapshots",
    "release_governance_observations",
    "audit_events",
})

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
MetricCategory = Literal["funnel", "pipeline", "activity", "scheduling", "communications", "ai_actions", "compliance", "release_governance", "executive"]
DashboardAudience = Literal["representative", "manager", "compliance", "workspace_admin", "executive"]
DashboardStatus = Literal["draft", "active", "retired"]
WidgetType = Literal["stat", "trend", "table", "funnel", "timeline", "alert", "scorecard"]
WidgetStatus = Literal["active", "hidden", "retired"]
SnapshotPeriod = Literal["hourly", "daily", "weekly", "monthly", "quarterly"]
ObservationType = Literal["exit_gate", "risk", "metric_gap", "test_gap", "policy_gap", "incident", "improvement"]
ObservationSeverity = Literal["info", "warning", "critical", "blocked"]
ObservationStatus = Literal["open", "in_review", "resolved", "accepted_risk"]

_READ_ROLES: set[str] = {"representative", "trainee", "trainer", "manager", "compliance_reviewer", "workspace_admin", "auditor"}
_ANALYTICS_WRITE_ROLES: set[str] = {"manager", "workspace_admin", "compliance_reviewer"}
_EXECUTIVE_WRITE_ROLES: set[str] = {"workspace_admin", "manager"}
_GOVERNANCE_WRITE_ROLES: set[str] = {"workspace_admin", "manager", "compliance_reviewer", "auditor"}


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


def _path(table: str, *, mutate: bool = False) -> str:
    if table not in _ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Unknown table: {table}")
    if mutate and table not in _MUTATION_TABLES:
        raise HTTPException(status_code=403, detail="Release 5 cannot mutate business records")
    return f"/rest/v1/{table}"


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
        response = await client.post(f"{base}{_path(table, mutate=True)}", headers=_headers(prefer), json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json() if response.content else []
    return data[0] if data else payload


async def _patch(table: str, params: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    base = _get_supabase_base()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(f"{base}{_path(table, mutate=True)}", headers=_headers(), params=params, json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json() if response.content else []
    return data[0] if data else payload


class MetricDefinitionCreate(BaseModel):
    workspace_id: str
    metric_key: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=1000)
    category: MetricCategory
    calculation_method: str = Field(min_length=1, max_length=1000)
    source_tables: list[str] = Field(default_factory=list)
    owner_role: str = Field(default="workspace_admin", max_length=120)
    is_active: bool = True


class MetricDefinitionPatch(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    calculation_method: str | None = Field(default=None, max_length=1000)
    source_tables: list[str] | None = None
    owner_role: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class ExecutiveDashboardCreate(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1, max_length=160)
    audience: DashboardAudience
    description: str | None = Field(default=None, max_length=1000)
    status: DashboardStatus = "draft"
    layout: dict[str, Any] = Field(default_factory=dict)


class ExecutiveDashboardPatch(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    audience: DashboardAudience | None = None
    description: str | None = Field(default=None, max_length=1000)
    status: DashboardStatus | None = None
    layout: dict[str, Any] | None = None


class DashboardWidgetCreate(BaseModel):
    workspace_id: str
    dashboard_id: str
    metric_definition_id: str | None = None
    widget_key: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=160)
    widget_type: WidgetType
    config: dict[str, Any] = Field(default_factory=dict)
    position_index: int = Field(default=0, ge=0)
    status: WidgetStatus = "active"


class DashboardWidgetPatch(BaseModel):
    metric_definition_id: str | None = None
    title: str | None = Field(default=None, max_length=160)
    widget_type: WidgetType | None = None
    config: dict[str, Any] | None = None
    position_index: int | None = Field(default=None, ge=0)
    status: WidgetStatus | None = None


class AnalyticsSnapshotCreate(BaseModel):
    workspace_id: str
    metric_definition_id: str | None = None
    metric_key: str = Field(min_length=1, max_length=160)
    snapshot_period: SnapshotPeriod
    period_start: str
    period_end: str
    value: float | None = None
    numerator: float | None = None
    denominator: float | None = None
    dimensions: dict[str, Any] = Field(default_factory=dict)
    source_watermark: str | None = None
    generated_by: str = Field(default="system", max_length=120)

    @model_validator(mode="after")
    def _validate_period(self) -> "AnalyticsSnapshotCreate":
        if self.period_start >= self.period_end:
            raise ValueError("period_start must be before period_end")
        if self.denominator is not None and self.denominator < 0:
            raise ValueError("denominator must be non-negative")
        return self


class FunnelStageSnapshotCreate(BaseModel):
    workspace_id: str
    pipeline_stage_id: str | None = None
    stage_name: str = Field(min_length=1, max_length=160)
    snapshot_date: str
    lead_count: int = Field(default=0, ge=0)
    entered_count: int = Field(default=0, ge=0)
    exited_count: int = Field(default=0, ge=0)
    conversion_rate: float | None = Field(default=None, ge=0, le=1)
    median_age_hours: float | None = Field(default=None, ge=0)


class AgentPerformanceSnapshotCreate(BaseModel):
    workspace_id: str
    agent_user_id: str
    snapshot_date: str
    assigned_lead_count: int = Field(default=0, ge=0)
    open_task_count: int = Field(default=0, ge=0)
    completed_task_count: int = Field(default=0, ge=0)
    appointment_count: int = Field(default=0, ge=0)
    no_show_count: int = Field(default=0, ge=0)
    communication_draft_count: int = Field(default=0, ge=0)
    ai_assistance_request_count: int = Field(default=0, ge=0)
    score: float | None = Field(default=None, ge=0, le=100)


class ComplianceMetricSnapshotCreate(BaseModel):
    workspace_id: str
    snapshot_date: str
    open_exception_count: int = Field(default=0, ge=0)
    blocked_communication_count: int = Field(default=0, ge=0)
    blocked_ai_action_count: int = Field(default=0, ge=0)
    pending_approval_count: int = Field(default=0, ge=0)
    unresolved_finding_count: int = Field(default=0, ge=0)
    audit_event_count: int = Field(default=0, ge=0)
    compliance_score: float | None = Field(default=None, ge=0, le=100)


class AiActionMetricSnapshotCreate(BaseModel):
    workspace_id: str
    snapshot_date: str
    proposed_count: int = Field(default=0, ge=0)
    approval_required_count: int = Field(default=0, ge=0)
    approved_count: int = Field(default=0, ge=0)
    blocked_count: int = Field(default=0, ge=0)
    rejected_count: int = Field(default=0, ge=0)
    executed_count: int = Field(default=0, ge=0)
    high_risk_count: int = Field(default=0, ge=0)
    automation_savings_minutes: float | None = Field(default=None, ge=0)


class ReleaseGovernanceObservationCreate(BaseModel):
    workspace_id: str
    release_key: str = Field(min_length=1, max_length=120)
    observation_type: ObservationType
    severity: ObservationSeverity = "info"
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(min_length=1, max_length=2000)
    status: ObservationStatus = "open"
    owner_id: str | None = None
    due_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReleaseGovernanceObservationPatch(BaseModel):
    severity: ObservationSeverity | None = None
    title: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=2000)
    status: ObservationStatus | None = None
    owner_id: str | None = None
    due_at: str | None = None
    resolved_at: str | None = None
    metadata: dict[str, Any] | None = None


async def _membership_required(workspace_id: str, user_id: str) -> dict[str, Any]:
    safe_workspace = _validate_uuid(workspace_id, "workspace_id")
    safe_user = _validate_uuid(user_id, "user_id")
    rows = await _query(
        "workspace_memberships",
        {
            "select": "id,role_id,status,roles(name)",
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


async def _workspace_context(workspace_id: str, user_id: str) -> dict[str, Any]:
    return await _membership_required(workspace_id, user_id)


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


def _filter_patch_payload(payload: dict[str, Any]) -> dict[str, Any]:
    forbidden = {"id", "workspace_id", "created_at", "created_by"}
    return {key: value for key, value in payload.items() if key not in forbidden and value is not None}


def _optional_uuid_filter(value: str | None, label: str) -> str | None:
    return f"eq.{_validate_uuid(value, label)}" if value else None


@router.get("/analytics/metric-definitions")
async def list_metric_definitions(workspace_id: str = Query(...), category: MetricCategory | None = None, is_active: bool | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if category:
        params["category"] = f"eq.{category}"
    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"
    return await _query("analytics_metric_definitions", params)


@router.post("/analytics/metric-definitions")
async def create_metric_definition(body: MetricDefinitionCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("analytics_metric_definitions", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "analytics_metric_definition.created", "analytics_metric_definition", record.get("id"), {"metric_key": body.metric_key})
    return record


@router.patch("/analytics/metric-definitions/{metric_definition_id}")
async def update_metric_definition(metric_definition_id: str, body: MetricDefinitionPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(metric_definition_id, "metric_definition_id")
    rows = await _query("analytics_metric_definitions", {"select": "id,workspace_id", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Metric definition not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    updated = await _patch("analytics_metric_definitions", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "analytics_metric_definition.updated", "analytics_metric_definition", safe_id, {"fields": sorted(payload)})
    return updated


@router.get("/analytics/executive-dashboards")
async def list_executive_dashboards(workspace_id: str = Query(...), audience: DashboardAudience | None = None, status: DashboardStatus | None = None, limit: int = Query(50, le=200), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if audience:
        params["audience"] = f"eq.{audience}"
    if status:
        params["status"] = f"eq.{status}"
    return await _query("executive_dashboards", params)


@router.post("/analytics/executive-dashboards")
async def create_executive_dashboard(body: ExecutiveDashboardCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _EXECUTIVE_WRITE_ROLES)
    record = await _insert("executive_dashboards", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "executive_dashboard.created", "executive_dashboard", record.get("id"), {"audience": body.audience})
    return record


@router.patch("/analytics/executive-dashboards/{dashboard_id}")
async def update_executive_dashboard(dashboard_id: str, body: ExecutiveDashboardPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(dashboard_id, "dashboard_id")
    rows = await _query("executive_dashboards", {"select": "id,workspace_id", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Executive dashboard not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _EXECUTIVE_WRITE_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    updated = await _patch("executive_dashboards", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "executive_dashboard.updated", "executive_dashboard", safe_id, {"fields": sorted(payload)})
    return updated


@router.get("/analytics/dashboard-widgets")
async def list_dashboard_widgets(workspace_id: str = Query(...), dashboard_id: str | None = None, status: WidgetStatus | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "position_index.asc", "limit": str(limit)}
    dashboard_filter = _optional_uuid_filter(dashboard_id, "dashboard_id")
    if dashboard_filter:
        params["dashboard_id"] = dashboard_filter
    if status:
        params["status"] = f"eq.{status}"
    return await _query("dashboard_widgets", params)


@router.post("/analytics/dashboard-widgets")
async def create_dashboard_widget(body: DashboardWidgetCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _EXECUTIVE_WRITE_ROLES)
    payload = body.model_dump()
    payload["workspace_id"] = context["workspace_id"]
    record = await _insert("dashboard_widgets", payload)
    await _audit(context["workspace_id"], user_id, "dashboard_widget.created", "dashboard_widget", record.get("id"), {"widget_key": body.widget_key})
    return record


@router.patch("/analytics/dashboard-widgets/{widget_id}")
async def update_dashboard_widget(widget_id: str, body: DashboardWidgetPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(widget_id, "widget_id")
    rows = await _query("dashboard_widgets", {"select": "id,workspace_id", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Dashboard widget not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _EXECUTIVE_WRITE_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    updated = await _patch("dashboard_widgets", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "dashboard_widget.updated", "dashboard_widget", safe_id, {"fields": sorted(payload)})
    return updated


@router.get("/analytics/snapshots")
async def list_analytics_snapshots(workspace_id: str = Query(...), metric_key: str | None = None, snapshot_period: SnapshotPeriod | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "period_start.desc", "limit": str(limit)}
    if metric_key:
        params["metric_key"] = f"eq.{metric_key}"
    if snapshot_period:
        params["snapshot_period"] = f"eq.{snapshot_period}"
    return await _query("analytics_snapshots", params)


@router.post("/analytics/snapshots")
async def create_analytics_snapshot(body: AnalyticsSnapshotCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("analytics_snapshots", {**body.model_dump(), "workspace_id": context["workspace_id"]})
    await _audit(context["workspace_id"], user_id, "analytics_snapshot.created", "analytics_snapshot", record.get("id"), {"metric_key": body.metric_key})
    return record


@router.get("/analytics/funnel-stage-snapshots")
async def list_funnel_stage_snapshots(workspace_id: str = Query(...), snapshot_date: str | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "snapshot_date.desc", "limit": str(limit)}
    if snapshot_date:
        params["snapshot_date"] = f"eq.{snapshot_date}"
    return await _query("funnel_stage_snapshots", params)


@router.post("/analytics/funnel-stage-snapshots")
async def create_funnel_stage_snapshot(body: FunnelStageSnapshotCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("funnel_stage_snapshots", {**body.model_dump(), "workspace_id": context["workspace_id"]})
    await _audit(context["workspace_id"], user_id, "funnel_stage_snapshot.created", "funnel_stage_snapshot", record.get("id"), {"stage_name": body.stage_name})
    return record


@router.get("/analytics/agent-performance-snapshots")
async def list_agent_performance_snapshots(workspace_id: str = Query(...), agent_user_id: str | None = None, snapshot_date: str | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "snapshot_date.desc", "limit": str(limit)}
    user_filter = _optional_uuid_filter(agent_user_id, "agent_user_id")
    if user_filter:
        params["agent_user_id"] = user_filter
    if snapshot_date:
        params["snapshot_date"] = f"eq.{snapshot_date}"
    return await _query("agent_performance_snapshots", params)


@router.post("/analytics/agent-performance-snapshots")
async def create_agent_performance_snapshot(body: AgentPerformanceSnapshotCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("agent_performance_snapshots", {**body.model_dump(), "workspace_id": context["workspace_id"]})
    await _audit(context["workspace_id"], user_id, "agent_performance_snapshot.created", "agent_performance_snapshot", record.get("id"), {"agent_user_id": body.agent_user_id})
    return record


@router.get("/analytics/compliance-metric-snapshots")
async def list_compliance_metric_snapshots(workspace_id: str = Query(...), snapshot_date: str | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "snapshot_date.desc", "limit": str(limit)}
    if snapshot_date:
        params["snapshot_date"] = f"eq.{snapshot_date}"
    return await _query("compliance_metric_snapshots", params)


@router.post("/analytics/compliance-metric-snapshots")
async def create_compliance_metric_snapshot(body: ComplianceMetricSnapshotCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("compliance_metric_snapshots", {**body.model_dump(), "workspace_id": context["workspace_id"]})
    await _audit(context["workspace_id"], user_id, "compliance_metric_snapshot.created", "compliance_metric_snapshot", record.get("id"), {"compliance_score": body.compliance_score})
    return record


@router.get("/analytics/ai-action-metric-snapshots")
async def list_ai_action_metric_snapshots(workspace_id: str = Query(...), snapshot_date: str | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "snapshot_date.desc", "limit": str(limit)}
    if snapshot_date:
        params["snapshot_date"] = f"eq.{snapshot_date}"
    return await _query("ai_action_metric_snapshots", params)


@router.post("/analytics/ai-action-metric-snapshots")
async def create_ai_action_metric_snapshot(body: AiActionMetricSnapshotCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _ANALYTICS_WRITE_ROLES)
    record = await _insert("ai_action_metric_snapshots", {**body.model_dump(), "workspace_id": context["workspace_id"]})
    await _audit(context["workspace_id"], user_id, "ai_action_metric_snapshot.created", "ai_action_metric_snapshot", record.get("id"), {"blocked_count": body.blocked_count})
    return record


@router.get("/analytics/release-governance-observations")
async def list_release_governance_observations(workspace_id: str = Query(...), release_key: str | None = None, status: ObservationStatus | None = None, severity: ObservationSeverity | None = None, limit: int = Query(100, le=300), user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if release_key:
        params["release_key"] = f"eq.{release_key}"
    if status:
        params["status"] = f"eq.{status}"
    if severity:
        params["severity"] = f"eq.{severity}"
    return await _query("release_governance_observations", params)


@router.post("/analytics/release-governance-observations")
async def create_release_governance_observation(body: ReleaseGovernanceObservationCreate, user_id: str = Depends(get_current_user_id)):
    context = await _workspace_context(body.workspace_id, user_id)
    _require_role(context, _GOVERNANCE_WRITE_ROLES)
    record = await _insert("release_governance_observations", {**body.model_dump(), "workspace_id": context["workspace_id"], "created_by": user_id})
    await _audit(context["workspace_id"], user_id, "release_governance_observation.created", "release_governance_observation", record.get("id"), {"release_key": body.release_key, "severity": body.severity})
    return record


@router.patch("/analytics/release-governance-observations/{observation_id}")
async def update_release_governance_observation(observation_id: str, body: ReleaseGovernanceObservationPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(observation_id, "observation_id")
    rows = await _query("release_governance_observations", {"select": "id,workspace_id", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Release governance observation not found")
    context = await _workspace_context(rows[0]["workspace_id"], user_id)
    _require_role(context, _GOVERNANCE_WRITE_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    updated = await _patch("release_governance_observations", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "release_governance_observation.updated", "release_governance_observation", safe_id, {"fields": sorted(payload)})
    return updated
