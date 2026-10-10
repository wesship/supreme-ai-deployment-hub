"""
backend/app/security/models.py — Pydantic models for the D3VONN Security module.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Severity(str, Enum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Outcome(str, Enum):
    success = "success"
    failure = "failure"
    unknown = "unknown"


class AlertStatus(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    investigating = "investigating"
    resolved = "resolved"
    false_positive = "false_positive"


class IncidentStatus(str, Enum):
    open = "open"
    triaging = "triaging"
    containment = "containment"
    eradication = "eradication"
    recovery = "recovery"
    closed = "closed"


class ActionResult(str, Enum):
    pending = "pending"
    success = "success"
    failure = "failure"
    skipped = "skipped"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SecurityEventCreate(BaseModel):
    source: str = Field(..., description="Origin system (e.g. 'd3vonn-api', 'supabase-auth')")
    event_type: str = Field(..., description="Event classification (e.g. 'auth.login_failed')")
    severity: Severity = Severity.info
    actor: Optional[str] = Field(None, description="User email, service account, or identifier")
    ip: Optional[str] = Field(None, description="Source IP address")
    metadata: dict[str, Any] = Field(default_factory=dict)
    outcome: Outcome = Outcome.unknown


class AlertUpdateRequest(BaseModel):
    status: AlertStatus
    resolved_by: Optional[str] = None


class IncidentCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: Severity = Severity.high
    alert_ids: list[UUID] = Field(default_factory=list)
    assigned_to: Optional[str] = None


class IncidentUpdateRequest(BaseModel):
    status: Optional[IncidentStatus] = None
    assigned_to: Optional[str] = None
    postmortem: Optional[str] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SecurityEventResponse(BaseModel):
    id: UUID
    created_at: datetime
    source: str
    event_type: str
    severity: str
    actor: Optional[str]
    ip: Optional[str]
    metadata: dict[str, Any]
    outcome: str


class SecurityAlertResponse(BaseModel):
    id: UUID
    created_at: datetime
    rule_id: str
    title: str
    description: Optional[str]
    severity: str
    status: str
    actor: Optional[str]
    ip: Optional[str]
    evidence: list[Any]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]


class SecurityIncidentResponse(BaseModel):
    id: UUID
    created_at: datetime
    title: str
    description: Optional[str]
    severity: str
    status: str
    alert_ids: list[UUID]
    assigned_to: Optional[str]
    resolved_at: Optional[datetime]
    postmortem: Optional[str]


class DetectionRuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    event_type: str
    threshold: int
    window_seconds: int
    severity: str
    enabled: bool


class DashboardStats(BaseModel):
    total_events_24h: int = 0
    open_alerts: int = 0
    critical_alerts: int = 0
    active_incidents: int = 0
    events_by_severity: dict[str, int] = Field(default_factory=dict)
    top_actors: list[dict[str, Any]] = Field(default_factory=list)
    recent_events: list[SecurityEventResponse] = Field(default_factory=list)
    recent_alerts: list[SecurityAlertResponse] = Field(default_factory=list)
