"""
backend/api/v1/router.py — D3VONN.IO REST API v1

Provides stable, versioned endpoints for agents, tasks, feature flags,
health checks, operations telemetry, incidents, governed remediation,
and wearable/vision ingress.
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter()


class AgentStatus(BaseModel):
    agent_id: str
    name: str
    status: str
    last_seen: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskCreate(BaseModel):
    task_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 5
    tenant_id: Optional[str] = None


class TaskResponse(BaseModel):
    task_id: str
    status: str
    task_type: str
    created_at: str


class FeatureFlag(BaseModel):
    name: str
    enabled: bool
    rollout_percentage: float = 100.0
    description: Optional[str] = None


class OpsComponent(BaseModel):
    name: str
    status: str
    latency_ms: Optional[int] = None
    detail: Optional[str] = None


class OpsHealthResponse(BaseModel):
    overall: str
    version: str
    environment: str
    checked_at: str
    components: List[OpsComponent]


class RemediationRequest(BaseModel):
    incident_id: Optional[str] = None
    component: str
    action_type: str
    reason: str
    risk_tier: str = "low"
    rollback_reference: Optional[str] = None


LOW_RISK_ACTIONS = {
    "restart_celery_worker",
    "restart_celery_beat",
    "restart_hermes",
    "rotate_application_logs",
    "prune_docker_build_cache",
    "retry_transient_workflow",
}
PROTECTED_ACTIONS = {
    "apply_database_migration",
    "rotate_production_secret",
    "merge_main",
    "deploy_production",
    "change_firewall_policy",
}


def _admin_guard(value: Optional[str]) -> None:
    expected = os.getenv("OPS_ADMIN_TOKEN", "")
    if not expected or value != expected:
        raise HTTPException(status_code=403, detail="operations admin authorization required")


async def _http_probe(name: str, url: Optional[str], expected: tuple[int, ...] = (200,)) -> OpsComponent:
    if not url:
        return OpsComponent(name=name, status="unknown", detail="not configured")
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            response = await client.get(url)
        latency = round((time.perf_counter() - started) * 1000)
        state = "healthy" if response.status_code in expected else "unhealthy"
        return OpsComponent(name=name, status=state, latency_ms=latency, detail=f"HTTP {response.status_code}")
    except Exception as exc:
        latency = round((time.perf_counter() - started) * 1000)
        return OpsComponent(name=name, status="unhealthy", latency_ms=latency, detail=type(exc).__name__)


def _redis_probe() -> OpsComponent:
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return OpsComponent(name="redis", status="unknown", detail="REDIS_URL not configured")
    started = time.perf_counter()
    try:
        import redis  # type: ignore

        client = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return OpsComponent(
            name="redis",
            status="healthy",
            latency_ms=round((time.perf_counter() - started) * 1000),
        )
    except Exception as exc:
        return OpsComponent(
            name="redis",
            status="unhealthy",
            latency_ms=round((time.perf_counter() - started) * 1000),
            detail=type(exc).__name__,
        )


async def _persist_health(components: List[OpsComponent]) -> None:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        return
    rows = [
        {
            "component": component.name,
            "status": component.status,
            "latency_ms": component.latency_ms,
            "source": "api-v1-ops",
            "evidence": {"detail": component.detail} if component.detail else {},
        }
        for component in components
    ]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{base}/rest/v1/ops_health_checks", headers=headers, json=rows)
    except Exception:
        return


@router.get("/agents", response_model=List[AgentStatus], summary="List all registered agents")
async def list_agents():
    return []


@router.get("/agents/{agent_id}", response_model=AgentStatus, summary="Get a single agent by ID")
async def get_agent(agent_id: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED, summary="Enqueue a background task")
async def create_task(task: TaskCreate):
    task_id = str(uuid.uuid4())
    return TaskResponse(
        task_id=task_id,
        status="queued",
        task_type=task.task_type,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse, summary="Get task status by ID")
async def get_task(task_id: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@router.get("/flags", response_model=List[FeatureFlag], summary="List all feature flags")
async def list_flags():
    return []


@router.get("/flags/{name}", response_model=FeatureFlag, summary="Get a single feature flag")
async def get_flag(name: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature flag not found")


@router.get("/health", summary="API v1 health check")
async def health():
    return {"api": "v1", "status": "ok"}


@router.get("/ops/health", response_model=OpsHealthResponse, summary="Unified operations health")
async def operations_health():
    probes = await asyncio.gather(
        _http_probe("frontend", os.getenv("OPS_FRONTEND_URL", "https://d3vonn.io")),
        _http_probe("backend", os.getenv("OPS_BACKEND_READY_URL", "https://api.d3vonn.io/health/ready")),
        _http_probe("supabase", f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/" if os.getenv("SUPABASE_URL") else None, expected=(200, 401)),
    )
    components = [OpsComponent(name="api", status="healthy"), _redis_probe(), *probes]
    unhealthy = any(item.status == "unhealthy" for item in components)
    degraded = any(item.status in {"degraded", "unknown"} for item in components)
    overall = "unhealthy" if unhealthy else "degraded" if degraded else "healthy"
    await _persist_health(components)
    return OpsHealthResponse(
        overall=overall,
        version=os.getenv("APP_VERSION", "2.0.0"),
        environment=os.getenv("ENVIRONMENT", "unknown"),
        checked_at=datetime.now(timezone.utc).isoformat(),
        components=components,
    )


@router.get("/ops/incidents", summary="List current operations incidents")
async def operations_incidents(
    limit: int = Query(default=50, ge=1, le=200),
    x_ops_admin_token: Optional[str] = Header(default=None),
):
    _admin_guard(x_ops_admin_token)
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="operations persistence is not configured")
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    params = {"select": "*", "order": "updated_at.desc", "limit": str(limit)}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{base}/rest/v1/ops_incidents", headers=headers, params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="incident store unavailable")
    return response.json()


@router.post("/ops/remediations", status_code=202, summary="Request a governed remediation")
async def request_remediation(
    request: RemediationRequest,
    x_ops_admin_token: Optional[str] = Header(default=None),
):
    _admin_guard(x_ops_admin_token)
    if request.risk_tier not in {"low", "medium", "high", "protected"}:
        raise HTTPException(status_code=422, detail="invalid risk tier")
    if request.action_type in PROTECTED_ACTIONS or request.risk_tier in {"high", "protected"}:
        approval_status = "pending"
        execution_status = "queued"
    elif request.action_type in LOW_RISK_ACTIONS:
        approval_status = "not_required"
        execution_status = "queued"
    else:
        approval_status = "pending"
        execution_status = "queued"

    row = {
        "incident_id": request.incident_id,
        "action_type": request.action_type,
        "component": request.component,
        "risk_tier": request.risk_tier,
        "requested_by": "operations-api",
        "approval_status": approval_status,
        "execution_status": execution_status,
        "reason": request.reason,
        "rollback_reference": request.rollback_reference,
    }
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="operations persistence is not configured")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{base}/rest/v1/ops_remediations", headers=headers, json=row)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="remediation request could not be recorded")
    return {"status": "accepted", "approval_required": approval_status == "pending", "remediation": response.json()[0]}


# Wearable ingress is kept in a dedicated module so vendor-specific integration
# work cannot destabilize the existing v1 API surface.
from backend.api.v1.wearable_router import router as wearable_router
router.include_router(wearable_router)
