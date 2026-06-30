"""
backend/app/security/router.py — D3VONN Cyber Command Center API Routes

Endpoints:
    POST   /api/security/events          — Ingest a security event
    GET    /api/security/events          — List recent events
    GET    /api/security/alerts          — List alerts
    PATCH  /api/security/alerts/{id}     — Update alert status
    GET    /api/security/incidents       — List incidents
    POST   /api/security/incidents       — Create incident
    PATCH  /api/security/incidents/{id}  — Update incident
    GET    /api/security/rules           — List detection rules
    GET    /api/security/dashboard       — Dashboard statistics
    POST   /api/security/sweep           — Trigger manual detection sweep
    GET    /api/security/agent/actions   — Agent action audit trail
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.security.models import (
    AlertStatus,
    AlertUpdateRequest,
    DashboardStats,
    DetectionRuleResponse,
    IncidentCreateRequest,
    IncidentUpdateRequest,
    SecurityAlertResponse,
    SecurityEventCreate,
    SecurityEventResponse,
    SecurityIncidentResponse,
)
from backend.app.security.detection import evaluate_event, run_detection_sweep
from backend.app.security.agent import handle_alert, get_agent_actions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/security", tags=["security-ops"])


# ---------------------------------------------------------------------------
# Dependency: Supabase client
# ---------------------------------------------------------------------------

def get_db():
    """
    Retrieve the Supabase client.

    This attempts multiple common patterns used in the project.
    Edit this function if your Supabase client is at a different path.
    """
    try:
        from supabase import create_client, Client

        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        if not url or not key:
            raise HTTPException(
                status_code=503,
                detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )

        client: Client = create_client(url, key)
        return client
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="supabase-py not installed. Run: pip install supabase",
        )


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

@router.post("/events", response_model=SecurityEventResponse, status_code=201)
async def create_event(payload: SecurityEventCreate, db=Depends(get_db)):
    """Ingest a security event and run detection evaluation."""
    event_data = {
        "source": payload.source,
        "event_type": payload.event_type,
        "severity": payload.severity.value,
        "actor": payload.actor,
        "ip": payload.ip,
        "metadata": payload.metadata,
        "outcome": payload.outcome.value,
    }

    # Insert event
    resp = db.table("security_events").insert(event_data).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to insert security event")

    event = resp.data[0]

    # Run detection engine
    try:
        alert = await evaluate_event(db, event)
        if alert:
            # Trigger Hermes Security Agent
            await handle_alert(db, alert)
    except Exception as exc:
        logger.error("Detection evaluation failed: %s", exc)

    return event


@router.get("/events", response_model=list[SecurityEventResponse])
async def list_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    actor: Optional[str] = None,
    db=Depends(get_db),
):
    """List recent security events with optional filters."""
    query = (
        db.table("security_events")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
    )

    if event_type:
        query = query.eq("event_type", event_type)
    if severity:
        query = query.eq("severity", severity)
    if actor:
        query = query.eq("actor", actor)

    resp = query.execute()
    return resp.data or []


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=list[SecurityAlertResponse])
async def list_alerts(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db=Depends(get_db),
):
    """List security alerts with optional status/severity filters."""
    query = (
        db.table("security_alerts")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)

    resp = query.execute()
    return resp.data or []


@router.patch("/alerts/{alert_id}", response_model=SecurityAlertResponse)
async def update_alert(alert_id: UUID, payload: AlertUpdateRequest, db=Depends(get_db)):
    """Update alert status (acknowledge, resolve, mark as false positive)."""
    update_data: dict[str, Any] = {"status": payload.status.value}

    if payload.status in (AlertStatus.resolved, AlertStatus.false_positive):
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
        if payload.resolved_by:
            update_data["resolved_by"] = payload.resolved_by

    resp = (
        db.table("security_alerts")
        .update(update_data)
        .eq("id", str(alert_id))
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Alert not found")

    return resp.data[0]


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

@router.get("/incidents", response_model=list[SecurityIncidentResponse])
async def list_incidents(
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db=Depends(get_db),
):
    """List security incidents."""
    query = (
        db.table("security_incidents")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if status:
        query = query.eq("status", status)

    resp = query.execute()
    return resp.data or []


@router.post("/incidents", response_model=SecurityIncidentResponse, status_code=201)
async def create_incident(payload: IncidentCreateRequest, db=Depends(get_db)):
    """Create a new security incident (escalation from alerts)."""
    incident_data = {
        "title": payload.title,
        "description": payload.description,
        "severity": payload.severity.value,
        "alert_ids": [str(aid) for aid in payload.alert_ids],
        "assigned_to": payload.assigned_to,
    }

    resp = db.table("security_incidents").insert(incident_data).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create incident")

    return resp.data[0]


@router.patch("/incidents/{incident_id}", response_model=SecurityIncidentResponse)
async def update_incident(
    incident_id: UUID,
    payload: IncidentUpdateRequest,
    db=Depends(get_db),
):
    """Update incident status, assignment, or postmortem."""
    update_data: dict[str, Any] = {}

    if payload.status:
        update_data["status"] = payload.status.value
        if payload.status == "closed":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if payload.assigned_to is not None:
        update_data["assigned_to"] = payload.assigned_to
    if payload.postmortem is not None:
        update_data["postmortem"] = payload.postmortem

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    resp = (
        db.table("security_incidents")
        .update(update_data)
        .eq("id", str(incident_id))
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Incident not found")

    return resp.data[0]


# ---------------------------------------------------------------------------
# Detection Rules
# ---------------------------------------------------------------------------

@router.get("/rules", response_model=list[DetectionRuleResponse])
async def list_rules(db=Depends(get_db)):
    """List all configured detection rules."""
    resp = db.table("detection_rules").select("*").order("id").execute()
    return resp.data or []


# ---------------------------------------------------------------------------
# Detection Sweep (manual trigger)
# ---------------------------------------------------------------------------

@router.post("/sweep")
async def trigger_sweep(
    lookback_seconds: int = Query(300, ge=60, le=3600),
    db=Depends(get_db),
):
    """Manually trigger a detection sweep over recent events."""
    new_alerts = await run_detection_sweep(db, lookback_seconds)
    return {
        "status": "completed",
        "new_alerts": len(new_alerts),
        "alerts": new_alerts,
    }


# ---------------------------------------------------------------------------
# Agent Actions
# ---------------------------------------------------------------------------

@router.get("/agent/actions")
async def list_agent_actions(
    limit: int = Query(20, ge=1, le=100),
    alert_id: Optional[str] = None,
    db=Depends(get_db),
):
    """Retrieve Hermes Security Agent action audit trail."""
    actions = await get_agent_actions(db, limit=limit, alert_id=alert_id)
    return {"actions": actions}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db=Depends(get_db)):
    """Aggregate dashboard statistics for the Security Command Center."""
    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(hours=24)).isoformat()

    # Total events in last 24h
    events_resp = (
        db.table("security_events")
        .select("id", count="exact")
        .gte("created_at", day_ago)
        .execute()
    )
    total_events_24h = events_resp.count if events_resp.count else 0

    # Open alerts
    open_alerts_resp = (
        db.table("security_alerts")
        .select("id", count="exact")
        .eq("status", "open")
        .execute()
    )
    open_alerts = open_alerts_resp.count if open_alerts_resp.count else 0

    # Critical open alerts
    critical_resp = (
        db.table("security_alerts")
        .select("id", count="exact")
        .eq("status", "open")
        .eq("severity", "critical")
        .execute()
    )
    critical_alerts = critical_resp.count if critical_resp.count else 0

    # Active incidents
    incidents_resp = (
        db.table("security_incidents")
        .select("id", count="exact")
        .neq("status", "closed")
        .execute()
    )
    active_incidents = incidents_resp.count if incidents_resp.count else 0

    # Events by severity (last 24h)
    severity_resp = (
        db.table("security_events")
        .select("severity")
        .gte("created_at", day_ago)
        .limit(1000)
        .execute()
    )
    events_by_severity: dict[str, int] = {}
    for ev in (severity_resp.data or []):
        sev = ev.get("severity", "info")
        events_by_severity[sev] = events_by_severity.get(sev, 0) + 1

    # Top actors (last 24h)
    actor_resp = (
        db.table("security_events")
        .select("actor")
        .gte("created_at", day_ago)
        .not_.is_("actor", "null")
        .limit(500)
        .execute()
    )
    actor_counts: dict[str, int] = {}
    for ev in (actor_resp.data or []):
        a = ev.get("actor", "")
        if a:
            actor_counts[a] = actor_counts.get(a, 0) + 1
    top_actors = sorted(
        [{"actor": k, "count": v} for k, v in actor_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Recent events
    recent_events_resp = (
        db.table("security_events")
        .select("*")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Recent alerts
    recent_alerts_resp = (
        db.table("security_alerts")
        .select("*")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    return DashboardStats(
        total_events_24h=total_events_24h,
        open_alerts=open_alerts,
        critical_alerts=critical_alerts,
        active_incidents=active_incidents,
        events_by_severity=events_by_severity,
        top_actors=top_actors,
        recent_events=recent_events_resp.data or [],
        recent_alerts=recent_alerts_resp.data or [],
    )
