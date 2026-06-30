"""
backend/app/security/router_v2.py — D3VONN Cyber Command Center v2 API

Extended router with endpoints for:
- Event ingestion (v2 schema: actor_id, actor_email, ip_address, metadata)
- SOAR playbook management
- Risk scoring
- Threat intelligence
- Correlation engine
- Knowledge graph queries
- Agent workforce management
- Compliance posture
- Metrics (MTTD/MTTR)
- Case management
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("d3vonn.security.v2")

router = APIRouter(prefix="/api/security/v2", tags=["security-v2"])


# ---------------------------------------------------------------------------
# Pydantic Models (v2 schema)
# ---------------------------------------------------------------------------

class SecurityEventV2(BaseModel):
    source: str
    event_type: str
    severity: str = "medium"
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    ip_address: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RiskScoreRequest(BaseModel):
    entity_type: str  # 'user' or 'ip'
    entity_id: str
    email: Optional[str] = None


class IOCRequest(BaseModel):
    ioc_type: str
    value: str
    severity: str = "medium"
    confidence: int = 80
    description: str = ""
    tags: list[str] = Field(default_factory=list)


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    assigned_to: Optional[str] = None
    incident_ids: list[str] = Field(default_factory=list)
    alert_ids: list[str] = Field(default_factory=list)


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    mitre_tactics: Optional[list[str]] = None
    mitre_techniques: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Dependency: Supabase client
# ---------------------------------------------------------------------------

def get_db():
    """Get Supabase client from environment."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Event Ingestion (v2)
# ---------------------------------------------------------------------------

@router.post("/events")
async def ingest_event_v2(event: SecurityEventV2):
    """Ingest a security event with v2 schema and trigger detection pipeline."""
    db = get_db()

    # Store event
    event_data = {
        "source": event.source,
        "event_type": event.event_type,
        "severity": event.severity,
        "actor": event.actor_email or event.actor_id,
        "ip": event.ip_address,
        "metadata": {
            **event.metadata,
            "actor_id": event.actor_id,
            "actor_email": event.actor_email,
        },
        "outcome": event.metadata.get("outcome", "unknown"),
    }

    try:
        resp = db.table("security_events").insert(event_data).execute()
        stored_event = resp.data[0] if resp.data else event_data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to store event: {exc}")

    # Run detection engine
    from backend.app.security.detection import DetectionEngine
    engine = DetectionEngine(db)
    alerts = await engine.evaluate(stored_event)

    # Run correlation engine
    from backend.app.security.correlation import CorrelationEngine
    correlator = CorrelationEngine(db)
    correlations = await correlator.correlate_alert(stored_event)

    # Enrich with threat intelligence
    from backend.app.security.threat_intel import ThreatIntelligenceLayer
    intel = ThreatIntelligenceLayer(db)
    enrichment = await intel.enrich_event(stored_event)

    # Ingest into knowledge graph
    from backend.app.security.knowledge_graph import SecurityKnowledgeGraph
    graph = SecurityKnowledgeGraph(db)
    await graph.ingest_event(stored_event)

    # Trigger SOAR if alerts were generated
    soar_results = []
    if alerts:
        from backend.app.security.soar import SOAREngine
        soar = SOAREngine(db)
        for alert in alerts:
            result = await soar.handle_alert(alert)
            soar_results.append(result)

    return {
        "status": "ingested",
        "event_id": stored_event.get("id"),
        "alerts_generated": len(alerts),
        "correlations_found": len(correlations),
        "enrichment": enrichment,
        "soar_executed": len(soar_results),
    }


# ---------------------------------------------------------------------------
# Risk Scoring
# ---------------------------------------------------------------------------

@router.post("/risk/score")
async def compute_risk_score(req: RiskScoreRequest):
    """Compute risk score for a user or IP."""
    db = get_db()
    from backend.app.security.risk_scoring import RiskScoringEngine
    engine = RiskScoringEngine(db)

    if req.entity_type == "user":
        return await engine.score_user(req.entity_id, req.email)
    elif req.entity_type == "ip":
        return await engine.score_ip(req.entity_id)
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'user' or 'ip'")


@router.get("/risk/scores")
async def list_risk_scores(entity_type: Optional[str] = None, min_score: int = 0, limit: int = 20):
    """List recent risk scores."""
    db = get_db()
    try:
        query = (
            db.table("security_risk_scores")
            .select("*")
            .gte("score", min_score)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if entity_type:
            query = query.eq("entity_type", entity_type)
        resp = query.execute()
        return {"scores": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Threat Intelligence
# ---------------------------------------------------------------------------

@router.get("/threat-intel/feeds")
async def list_threat_feeds():
    """List all threat intelligence feeds and their status."""
    db = get_db()
    from backend.app.security.threat_intel import ThreatIntelligenceLayer
    intel = ThreatIntelligenceLayer(db)
    feeds = await intel.get_feed_status()
    return {"feeds": feeds}


@router.post("/threat-intel/sync")
async def sync_threat_feeds():
    """Trigger sync of all enabled threat feeds."""
    db = get_db()
    from backend.app.security.threat_intel import ThreatIntelligenceLayer
    intel = ThreatIntelligenceLayer(db)
    result = await intel.sync_threat_feeds()
    return result


@router.post("/threat-intel/iocs")
async def add_ioc(req: IOCRequest):
    """Manually add an Indicator of Compromise."""
    db = get_db()
    from backend.app.security.threat_intel import ThreatIntelligenceLayer
    intel = ThreatIntelligenceLayer(db)
    result = await intel.add_ioc(
        ioc_type=req.ioc_type,
        value=req.value,
        severity=req.severity,
        confidence=req.confidence,
        description=req.description,
        tags=req.tags,
    )
    return result


@router.get("/threat-intel/enrich/{ip}")
async def enrich_ip(ip: str):
    """Enrich an IP address with threat intelligence."""
    db = get_db()
    from backend.app.security.threat_intel import ThreatIntelligenceLayer
    intel = ThreatIntelligenceLayer(db)
    return await intel.enrich_ip(ip)


# ---------------------------------------------------------------------------
# Correlation Engine
# ---------------------------------------------------------------------------

@router.get("/correlations")
async def list_correlations(
    correlation_type: Optional[str] = None,
    min_confidence: int = 50,
    limit: int = 20,
):
    """List event correlations."""
    db = get_db()
    from backend.app.security.correlation import CorrelationEngine
    engine = CorrelationEngine(db)
    correlations = await engine.get_correlations(correlation_type, min_confidence, limit)
    return {"correlations": correlations}


# ---------------------------------------------------------------------------
# Knowledge Graph
# ---------------------------------------------------------------------------

@router.get("/graph/query")
async def query_graph(node_type: str, node_id: str, depth: int = 1, relationship: Optional[str] = None):
    """Query the security knowledge graph."""
    db = get_db()
    from backend.app.security.knowledge_graph import SecurityKnowledgeGraph
    graph = SecurityKnowledgeGraph(db)
    result = await graph.query_connections(node_type, node_id, depth, relationship)
    return result


@router.get("/graph/attack-paths/{actor}")
async def get_attack_paths(actor: str):
    """Find attack paths for a given actor."""
    db = get_db()
    from backend.app.security.knowledge_graph import SecurityKnowledgeGraph
    graph = SecurityKnowledgeGraph(db)
    paths = await graph.find_attack_paths(actor)
    return {"actor": actor, "paths": paths}


@router.get("/graph/stats")
async def graph_stats():
    """Get knowledge graph statistics."""
    db = get_db()
    from backend.app.security.knowledge_graph import SecurityKnowledgeGraph
    graph = SecurityKnowledgeGraph(db)
    return await graph.get_graph_stats()


# ---------------------------------------------------------------------------
# SOAR Playbooks
# ---------------------------------------------------------------------------

@router.get("/playbooks")
async def list_playbooks():
    """List all SOAR playbooks."""
    db = get_db()
    try:
        resp = db.table("security_playbooks").select("*").order("name").execute()
        return {"playbooks": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/playbooks/{playbook_id}/execute")
async def execute_playbook(playbook_id: str, alert: dict[str, Any] = {}):
    """Manually trigger a SOAR playbook."""
    db = get_db()
    try:
        resp = db.table("security_playbooks").select("*").eq("id", playbook_id).limit(1).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Playbook not found")

        from backend.app.security.soar import SOAREngine
        soar = SOAREngine(db)
        result = await soar._execute_playbook(resp.data[0], alert)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Agent Workforce
# ---------------------------------------------------------------------------

@router.get("/agents")
async def list_agents():
    """List all security agents and their status."""
    db = get_db()
    try:
        resp = db.table("security_agent_workforce").select("*").execute()
        return {"agents": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/agents/{agent_id}/tasks")
async def list_agent_tasks(agent_id: str, status: Optional[str] = None, limit: int = 20):
    """List tasks for a specific agent."""
    db = get_db()
    try:
        query = (
            db.table("security_agent_tasks")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        resp = query.execute()
        return {"tasks": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/agents/{agent_id}/dispatch")
async def dispatch_agent(agent_id: str, task_type: str = "investigate", input_data: dict[str, Any] = {}):
    """Manually dispatch a task to an agent."""
    db = get_db()
    try:
        resp = db.table("security_agent_tasks").insert({
            "agent_id": agent_id,
            "task_type": task_type,
            "priority": 7,
            "status": "queued",
            "input_data": input_data,
        }).execute()
        return {"status": "dispatched", "task": resp.data[0] if resp.data else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Case Management
# ---------------------------------------------------------------------------

@router.get("/cases")
async def list_cases(status: Optional[str] = None, limit: int = 20):
    """List security investigation cases."""
    db = get_db()
    try:
        query = (
            db.table("security_cases")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        resp = query.execute()
        return {"cases": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/cases")
async def create_case(case: CaseCreate):
    """Create a new investigation case."""
    db = get_db()
    try:
        resp = db.table("security_cases").insert({
            "title": case.title,
            "description": case.description,
            "severity": case.severity,
            "assigned_to": case.assigned_to,
            "incident_ids": case.incident_ids,
            "alert_ids": case.alert_ids,
        }).execute()
        return {"status": "created", "case": resp.data[0] if resp.data else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/cases/{case_id}")
async def update_case(case_id: str, update: CaseUpdate):
    """Update a case."""
    db = get_db()
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if update_data.get("status") == "closed":
        update_data["closed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        resp = db.table("security_cases").update(update_data).eq("id", case_id).execute()
        return {"status": "updated", "case": resp.data[0] if resp.data else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Compliance
# ---------------------------------------------------------------------------

@router.get("/compliance")
async def get_compliance_posture(framework: Optional[str] = None):
    """Get compliance posture across frameworks."""
    db = get_db()
    try:
        query = db.table("security_compliance").select("*").order("framework")
        if framework:
            query = query.eq("framework", framework)
        resp = query.execute()
        return {"controls": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Metrics (MTTD / MTTR)
# ---------------------------------------------------------------------------

@router.get("/metrics")
async def get_metrics(metric_type: Optional[str] = None, limit: int = 30):
    """Get security operations metrics."""
    db = get_db()
    try:
        query = (
            db.table("security_metrics")
            .select("*")
            .order("period_start", desc=True)
            .limit(limit)
        )
        if metric_type:
            query = query.eq("metric_type", metric_type)
        resp = query.execute()
        return {"metrics": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Enhanced Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def dashboard_v2():
    """Enhanced dashboard with MTTD, MTTR, agent status, and compliance summary."""
    db = get_db()
    dashboard: dict[str, Any] = {}

    try:
        # Event count (24h)
        from datetime import timedelta
        window = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        events_resp = db.table("security_events").select("id", count="exact").gte("created_at", window).execute()
        dashboard["events_24h"] = events_resp.count or 0

        # Active alerts
        alerts_resp = db.table("security_alerts").select("id", count="exact").eq("status", "open").execute()
        dashboard["active_alerts"] = alerts_resp.count or 0

        # Open incidents
        incidents_resp = db.table("security_incidents").select("id", count="exact").eq("status", "open").execute()
        dashboard["open_incidents"] = incidents_resp.count or 0

        # Open cases
        cases_resp = db.table("security_cases").select("id", count="exact").in_("status", ["open", "in_progress"]).execute()
        dashboard["open_cases"] = cases_resp.count or 0

        # Agent workforce status
        agents_resp = db.table("security_agent_workforce").select("id, name, status, last_heartbeat, tasks_completed").execute()
        dashboard["agents"] = agents_resp.data or []

        # Recent correlations
        corr_resp = db.table("security_correlations").select("*").order("created_at", desc=True).limit(5).execute()
        dashboard["recent_correlations"] = corr_resp.data or []

        # Compliance summary
        compliance_resp = db.table("security_compliance").select("framework, status").execute()
        compliance_data = compliance_resp.data or []
        compliance_summary: dict[str, dict[str, int]] = {}
        for c in compliance_data:
            fw = c.get("framework", "unknown")
            st = c.get("status", "not_assessed")
            if fw not in compliance_summary:
                compliance_summary[fw] = {}
            compliance_summary[fw][st] = compliance_summary[fw].get(st, 0) + 1
        dashboard["compliance_summary"] = compliance_summary

        # Top risk scores
        risk_resp = (
            db.table("security_risk_scores")
            .select("entity_type, entity_id, score, factors, created_at")
            .order("score", desc=True)
            .limit(10)
            .execute()
        )
        dashboard["top_risks"] = risk_resp.data or []

    except Exception as exc:
        dashboard["error"] = str(exc)

    return dashboard
