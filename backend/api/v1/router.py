"""
backend/api/v1/router.py — D3VONN.IO REST API v1

Provides stable, versioned endpoints for agents, tasks, feature flags,
health checks, operations telemetry, incidents, and governed remediation.
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

from backend.api.v1.wearable_router import router as wearable_router
from backend.api.v1.insurance_capital_router import router as insurance_capital_router

router = APIRouter()
router.include_router(wearable_router)
router.include_router(insurance_capital_router)


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
