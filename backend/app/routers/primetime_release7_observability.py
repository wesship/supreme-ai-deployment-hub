"""PRIMETIME Release 7 — Advanced Telemetry and Observability.

This router records bounded operational telemetry, governed SLO definitions,
immutable evaluations, and auditable alert lifecycle changes. It is not a CRM,
communication, quoting, policy, application, or autonomous-execution surface.
No DELETE endpoints are exposed.
"""
from __future__ import annotations

import math
import os
import re
from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from ..middleware.auth import get_current_user_id

router = APIRouter(prefix="/primetime/v1", tags=["primetime-release7-observability"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ALLOWED_HOST_RE = re.compile(r"^[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_SAFE_DIMENSION_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_FORBIDDEN_DIMENSION_KEYS = frozenset({"email", "phone", "token", "secret", "authorization", "cookie", "payload", "body", "message"})

_ALLOWED_TABLES = frozenset({
    "workspace_memberships",
    "roles",
    "telemetry_signals",
    "slo_definitions",
    "slo_evaluations",
    "telemetry_alerts",
    "audit_events",
})

_TABLE_NAMES = {
    "workspace_memberships": "primetime_workspace_memberships",
    "roles": "primetime_roles",
    "telemetry_signals": "primetime_telemetry_signals",
    "slo_definitions": "primetime_slo_definitions",
    "slo_evaluations": "primetime_slo_evaluations",
    "telemetry_alerts": "primetime_telemetry_alerts",
    "audit_events": "primetime_audit_events",
}

_MUTATION_TABLES = frozenset({"telemetry_signals", "slo_definitions", "slo_evaluations", "telemetry_alerts", "audit_events"})

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
TelemetryDomain = Literal["runtime", "deployment", "agent", "scheduler", "queue", "compliance", "infrastructure", "release"]
SloComparator = Literal["lte", "gte"]
SloSeverity = Literal["warning", "critical"]
SloStatus = Literal["active", "paused", "retired"]
EvaluationStatus = Literal["compliant", "warning", "breached"]
AlertStatus = Literal["open", "acknowledged", "resolved", "silenced"]

_READ_ROLES: set[str] = {"representative", "trainee", "trainer", "manager", "compliance_reviewer", "workspace_admin", "auditor"}
_TELEMETRY_WRITE_ROLES: set[str] = {"manager", "workspace_admin", "compliance_reviewer", "auditor"}
_ALERT_LIFECYCLE_ROLES: set[str] = {"manager", "workspace_admin", "compliance_reviewer", "auditor"}


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
        raise HTTPException(status_code=400, detail="Unknown telemetry table")
    if mutate and table not in _MUTATION_TABLES:
        raise HTTPException(status_code=403, detail="Release 7 cannot mutate business records")
    return f"/rest/v1/{_TABLE_NAMES[table]}"


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


def _validate_dimensions(value: dict[str, str]) -> dict[str, str]:
    if len(value) > 12:
        raise ValueError("dimensions may contain at most 12 values")
    safe: dict[str, str] = {}
    for key, raw in value.items():
        normalized = key.lower()
        if normalized in _FORBIDDEN_DIMENSION_KEYS or not _SAFE_DIMENSION_KEY_RE.match(normalized):
            raise ValueError("dimensions contain an unsafe key")
        if not isinstance(raw, str) or not raw.strip() or len(raw) > 128:
            raise ValueError("dimension values must be non-empty strings of at most 128 characters")
        safe[normalized] = raw.strip()
    return safe


class TelemetrySignalCreate(BaseModel):
    workspace_id: str
    metric_key: str = Field(min_length=1, max_length=160, pattern=r"^[a-z][a-z0-9_.:-]*$")
    domain: TelemetryDomain
    value: float = Field(ge=0)
    unit: str = Field(default="count", min_length=1, max_length=64)
    observed_at: datetime
    source: str = Field(default="system", min_length=1, max_length=120)
    correlation_id: str | None = Field(default=None, max_length=160)
    deployment_version: str | None = Field(default=None, max_length=160)
    dimensions: dict[str, str] = Field(default_factory=dict)

    @field_validator("value")
    @classmethod
    def _value_is_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("value must be finite")
        return value

    @field_validator("dimensions")
    @classmethod
    def _dimensions_are_safe(cls, value: dict[str, str]) -> dict[str, str]:
        return _validate_dimensions(value)


class SloDefinitionCreate(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1, max_length=160)
    metric_key: str = Field(min_length=1, max_length=160, pattern=r"^[a-z][a-z0-9_.:-]*$")
    domain: TelemetryDomain
    comparator: SloComparator
    target_value: float = Field(ge=0)
    warning_threshold: float | None = Field(default=None, ge=0)
    evaluation_window_seconds: int = Field(default=300, ge=60, le=604800)
    severity: SloSeverity = "warning"
    status: SloStatus = "active"
    description: str = Field(default="", max_length=1000)

    @field_validator("target_value", "warning_threshold")
    @classmethod
    def _threshold_is_finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("thresholds must be finite")
        return value

    @model_validator(mode="after")
    def _validate_threshold_order(self) -> "SloDefinitionCreate":
        if self.warning_threshold is None:
            return self
        if self.comparator == "lte" and self.warning_threshold >= self.target_value:
            raise ValueError("warning_threshold must be lower than target_value for lte SLOs")
        if self.comparator == "gte" and self.warning_threshold <= self.target_value:
            raise ValueError("warning_threshold must be higher than target_value for gte SLOs")
        return self


class SloDefinitionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    warning_threshold: float | None = Field(default=None, ge=0)
    evaluation_window_seconds: int | None = Field(default=None, ge=60, le=604800)
    severity: SloSeverity | None = None
    status: SloStatus | None = None
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("warning_threshold")
    @classmethod
    def _patch_threshold_is_finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("warning_threshold must be finite")
        return value


class SloEvaluationCreate(BaseModel):
    workspace_id: str
    slo_definition_id: str
    source_signal_id: str | None = None
    measured_value: float = Field(ge=0)
    evaluated_at: datetime | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    evaluation_metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("measured_value")
    @classmethod
    def _measurement_is_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("measured_value must be finite")
        return value

    @field_validator("evaluation_metadata")
    @classmethod
    def _metadata_is_safe(cls, value: dict[str, str]) -> dict[str, str]:
        return _validate_dimensions(value)

    @model_validator(mode="after")
    def _window_is_valid(self) -> "SloEvaluationCreate":
        if self.window_start and self.window_end and self.window_start >= self.window_end:
            raise ValueError("window_start must be before window_end")
        return self


class TelemetryAlertPatch(BaseModel):
    status: AlertStatus


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
    role = rows[0].get("roles") or {}
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


def _optional_uuid_filter(value: str | None, label: str) -> str | None:
    return f"eq.{_validate_uuid(value, label)}" if value else None


def _filter_patch_payload(payload: dict[str, Any]) -> dict[str, Any]:
    forbidden = {"id", "workspace_id", "created_at", "created_by", "target_value", "comparator", "metric_key", "domain"}
    return {key: value for key, value in payload.items() if key not in forbidden and value is not None}


def _evaluate_slo(definition: dict[str, Any], measured_value: float) -> EvaluationStatus:
    comparator = definition["comparator"]
    target = float(definition["target_value"])
    warning = definition.get("warning_threshold")
    warning_value = float(warning) if warning is not None else None

    if comparator == "lte":
        if measured_value > target:
            return "breached"
        if warning_value is not None and measured_value > warning_value:
            return "warning"
    else:
        if measured_value < target:
            return "breached"
        if warning_value is not None and measured_value < warning_value:
            return "warning"
    return "compliant"


@router.get("/observability/signals")
async def list_telemetry_signals(
    workspace_id: str = Query(...),
    metric_key: str | None = None,
    domain: TelemetryDomain | None = None,
    limit: int = Query(100, ge=1, le=300),
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "observed_at.desc", "limit": str(limit)}
    if metric_key:
        params["metric_key"] = f"eq.{metric_key}"
    if domain:
        params["domain"] = f"eq.{domain}"
    return await _query("telemetry_signals", params)


@router.post("/observability/signals")
async def create_telemetry_signal(body: TelemetrySignalCreate, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _TELEMETRY_WRITE_ROLES)
    payload = body.model_dump(mode="json")
    payload.update({"workspace_id": context["workspace_id"], "recorded_by": user_id})
    record = await _insert("telemetry_signals", payload)
    await _audit(context["workspace_id"], user_id, "telemetry_signal.recorded", "telemetry_signal", record.get("id"), {"metric_key": body.metric_key, "domain": body.domain})
    return record


@router.get("/observability/slos")
async def list_slo_definitions(
    workspace_id: str = Query(...),
    status: SloStatus | None = None,
    domain: TelemetryDomain | None = None,
    limit: int = Query(100, ge=1, le=300),
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "created_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    if domain:
        params["domain"] = f"eq.{domain}"
    return await _query("slo_definitions", params)


@router.post("/observability/slos")
async def create_slo_definition(body: SloDefinitionCreate, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _TELEMETRY_WRITE_ROLES)
    payload = body.model_dump()
    payload.update({"workspace_id": context["workspace_id"], "created_by": user_id})
    record = await _insert("slo_definitions", payload)
    await _audit(context["workspace_id"], user_id, "telemetry_slo.created", "telemetry_slo", record.get("id"), {"metric_key": body.metric_key, "comparator": body.comparator})
    return record


@router.patch("/observability/slos/{slo_id}")
async def update_slo_definition(slo_id: str, body: SloDefinitionPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(slo_id, "slo_id")
    rows = await _query("slo_definitions", {"select": "id,workspace_id,comparator,target_value,warning_threshold", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="SLO definition not found")
    context = await _membership_required(rows[0]["workspace_id"], user_id)
    _require_role(context, _TELEMETRY_WRITE_ROLES)
    payload = _filter_patch_payload(body.model_dump())
    warning = payload.get("warning_threshold")
    if warning is not None:
        target = float(rows[0]["target_value"])
        if rows[0]["comparator"] == "lte" and warning >= target:
            raise HTTPException(status_code=400, detail="warning_threshold must be lower than target_value for lte SLOs")
        if rows[0]["comparator"] == "gte" and warning <= target:
            raise HTTPException(status_code=400, detail="warning_threshold must be higher than target_value for gte SLOs")
    updated = await _patch("slo_definitions", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "telemetry_slo.updated", "telemetry_slo", safe_id, {"fields": sorted(payload)})
    return updated


@router.get("/observability/evaluations")
async def list_slo_evaluations(
    workspace_id: str = Query(...),
    slo_definition_id: str | None = None,
    evaluation_status: EvaluationStatus | None = None,
    limit: int = Query(100, ge=1, le=300),
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "evaluated_at.desc", "limit": str(limit)}
    slo_filter = _optional_uuid_filter(slo_definition_id, "slo_definition_id")
    if slo_filter:
        params["slo_definition_id"] = slo_filter
    if evaluation_status:
        params["evaluation_status"] = f"eq.{evaluation_status}"
    return await _query("slo_evaluations", params)


@router.post("/observability/evaluations")
async def create_slo_evaluation(body: SloEvaluationCreate, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _TELEMETRY_WRITE_ROLES)
    safe_slo = _validate_uuid(body.slo_definition_id, "slo_definition_id")
    definitions = await _query("slo_definitions", {"select": "id,workspace_id,name,metric_key,comparator,target_value,warning_threshold,severity,status", "id": f"eq.{safe_slo}", "workspace_id": f"eq.{context['workspace_id']}", "limit": "1"})
    if not definitions:
        raise HTTPException(status_code=404, detail="SLO definition not found in workspace")
    definition = definitions[0]
    if definition["status"] != "active":
        raise HTTPException(status_code=409, detail="Only active SLO definitions may be evaluated")

    source_signal_id = _optional_uuid_filter(body.source_signal_id, "source_signal_id")
    if source_signal_id:
        signals = await _query("telemetry_signals", {"select": "id,workspace_id,metric_key", "id": source_signal_id, "workspace_id": f"eq.{context['workspace_id']}", "limit": "1"})
        if not signals:
            raise HTTPException(status_code=404, detail="Source telemetry signal not found in workspace")
        if signals[0]["metric_key"] != definition["metric_key"]:
            raise HTTPException(status_code=400, detail="Source telemetry signal metric_key must match the SLO metric_key")

    evaluation_status = _evaluate_slo(definition, body.measured_value)
    payload = body.model_dump(mode="json")
    payload.update({
        "workspace_id": context["workspace_id"],
        "slo_definition_id": safe_slo,
        "evaluation_status": evaluation_status,
        "evaluated_by": user_id,
    })
    record = await _insert("slo_evaluations", payload)
    await _audit(context["workspace_id"], user_id, "telemetry_slo.evaluated", "telemetry_slo_evaluation", record.get("id"), {"slo_definition_id": safe_slo, "evaluation_status": evaluation_status})
    return record


@router.get("/observability/alerts")
async def list_telemetry_alerts(
    workspace_id: str = Query(...),
    status: AlertStatus | None = None,
    severity: SloSeverity | None = None,
    limit: int = Query(100, ge=1, le=300),
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    params = {"select": "*", "workspace_id": f"eq.{context['workspace_id']}", "order": "opened_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    if severity:
        params["severity"] = f"eq.{severity}"
    return await _query("telemetry_alerts", params)


@router.post("/observability/evaluations/{evaluation_id}/alerts")
async def open_telemetry_alert(evaluation_id: str, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(evaluation_id, "evaluation_id")
    evaluations = await _query("slo_evaluations", {"select": "id,workspace_id,slo_definition_id,measured_value,evaluation_status", "id": f"eq.{safe_id}", "limit": "1"})
    if not evaluations:
        raise HTTPException(status_code=404, detail="SLO evaluation not found")
    evaluation = evaluations[0]
    context = await _membership_required(evaluation["workspace_id"], user_id)
    _require_role(context, _ALERT_LIFECYCLE_ROLES)
    if evaluation["evaluation_status"] == "compliant":
        raise HTTPException(status_code=409, detail="Compliant SLO evaluations cannot open telemetry alerts")
    existing = await _query("telemetry_alerts", {"select": "id", "slo_evaluation_id": f"eq.{safe_id}", "limit": "1"})
    if existing:
        raise HTTPException(status_code=409, detail="A telemetry alert already exists for this evaluation")
    definitions = await _query("slo_definitions", {"select": "id,name,severity", "id": f"eq.{evaluation['slo_definition_id']}", "workspace_id": f"eq.{context['workspace_id']}", "limit": "1"})
    if not definitions:
        raise HTTPException(status_code=404, detail="SLO definition not found in workspace")
    definition = definitions[0]
    payload = {
        "workspace_id": context["workspace_id"],
        "slo_evaluation_id": safe_id,
        "slo_definition_id": evaluation["slo_definition_id"],
        "severity": definition["severity"],
        "status": "open",
        "title": f"SLO {definition['name']} {evaluation['evaluation_status']}",
        "description": f"Measured value: {evaluation['measured_value']}. Review the governed SLO evaluation for operational context.",
        "lifecycle_updated_by": user_id,
    }
    record = await _insert("telemetry_alerts", payload)
    await _audit(context["workspace_id"], user_id, "telemetry_alert.opened", "telemetry_alert", record.get("id"), {"slo_evaluation_id": safe_id, "severity": definition["severity"]})
    return record


@router.patch("/observability/alerts/{alert_id}")
async def update_telemetry_alert(alert_id: str, body: TelemetryAlertPatch, user_id: str = Depends(get_current_user_id)):
    safe_id = _validate_uuid(alert_id, "alert_id")
    rows = await _query("telemetry_alerts", {"select": "id,workspace_id,status", "id": f"eq.{safe_id}", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Telemetry alert not found")
    alert = rows[0]
    context = await _membership_required(alert["workspace_id"], user_id)
    _require_role(context, _ALERT_LIFECYCLE_ROLES)
    if alert["status"] in {"resolved", "silenced"} and body.status != alert["status"]:
        raise HTTPException(status_code=409, detail="Resolved or silenced alerts cannot be reopened through Release 7")
    payload: dict[str, Any] = {"status": body.status, "lifecycle_updated_by": user_id}
    now = datetime.utcnow().isoformat() + "Z"
    if body.status == "acknowledged":
        payload["acknowledged_at"] = now
    elif body.status == "resolved":
        payload["resolved_at"] = now
    elif body.status == "silenced":
        payload["silenced_at"] = now
    updated = await _patch("telemetry_alerts", {"id": f"eq.{safe_id}"}, payload)
    await _audit(context["workspace_id"], user_id, "telemetry_alert.lifecycle_updated", "telemetry_alert", safe_id, {"status": body.status})
    return updated


@router.get("/observability/overview")
async def get_observability_overview(workspace_id: str = Query(...), user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(workspace_id, user_id)
    _require_role(context, _READ_ROLES)
    workspace_filter = f"eq.{context['workspace_id']}"
    signals, slos, evaluations, alerts = await _gather_overview(workspace_filter)
    active_alerts = [alert for alert in alerts if alert.get("status") in {"open", "acknowledged"}]
    breached_count = sum(1 for item in evaluations if item.get("evaluation_status") == "breached")
    return {
        "workspace_id": context["workspace_id"],
        "recent_signals": signals,
        "active_slos": slos,
        "recent_evaluations": evaluations,
        "active_alerts": active_alerts,
        "summary": {
            "recent_signal_count": len(signals),
            "active_slo_count": len(slos),
            "recent_breached_evaluation_count": breached_count,
            "active_alert_count": len(active_alerts),
            "status": "attention" if active_alerts or breached_count else "healthy",
        },
    }


async def _gather_overview(workspace_filter: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    signals = await _query("telemetry_signals", {"select": "*", "workspace_id": workspace_filter, "order": "observed_at.desc", "limit": "12"})
    slos = await _query("slo_definitions", {"select": "*", "workspace_id": workspace_filter, "status": "eq.active", "order": "created_at.desc", "limit": "100"})
    evaluations = await _query("slo_evaluations", {"select": "*", "workspace_id": workspace_filter, "order": "evaluated_at.desc", "limit": "20"})
    alerts = await _query("telemetry_alerts", {"select": "*", "workspace_id": workspace_filter, "order": "opened_at.desc", "limit": "100"})
    return signals, slos, evaluations, alerts
