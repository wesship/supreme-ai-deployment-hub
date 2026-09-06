"""API for the D3VONN Cyber Tool Registry and governed passive intelligence."""
from __future__ import annotations

import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.security.passive_intel import PassiveIntelError, virustotal_enrich
from backend.app.security.tool_registry import (
    RiskTier,
    ToolStatus,
    evaluate_policy,
    get_tool,
    graph_projection,
    list_tools,
    stix_projection,
)

router = APIRouter(prefix="/tools", tags=["security-tool-registry"])


class ToolPolicyRequest(BaseModel):
    tool_id: str = Field(..., min_length=1, max_length=100)
    capability: str = Field(..., min_length=1, max_length=120)
    environment: Literal["production", "staging", "development", "test", "sandbox", "lab"] = "production"
    asset_authorized: bool = False
    human_approved: bool = False
    actor: Literal["security_agent", "hermes", "general_agent", "human"] = "hermes"


class PassiveEnrichmentRequest(BaseModel):
    indicator_type: Literal["ip", "domain", "url", "hash"]
    indicator: str = Field(..., min_length=1, max_length=2048)


def get_audit_db():
    """Return the service-role Supabase client required for security audit writes."""
    try:
        from supabase import create_client
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="security_audit_store_unavailable") from exc

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="security_audit_store_not_configured")
    return create_client(url, key)


@router.get("/health")
async def tool_registry_health():
    tools = list_tools()
    risk_counts = {tier.value: 0 for tier in RiskTier}
    status_counts = {state.value: 0 for state in ToolStatus}
    for tool in tools:
        risk_counts[tool.risk_tier.value] += 1
        status_counts[tool.status.value] += 1
    return {
        "status": "ok",
        "mode": "governed_registry_with_passive_intel",
        "tool_count": len(tools),
        "risk_counts": risk_counts,
        "status_counts": status_counts,
        "passive_enrichment_enabled": True,
        "passive_enrichment_requires_audit_store": True,
        "active_scan_execution_enabled": False,
        "exploit_execution_enabled": False,
        "credential_attack_execution_enabled": False,
    }


@router.get("")
@router.get("/")
async def get_tools(
    category: str | None = Query(default=None),
    risk_tier: RiskTier | None = Query(default=None),
    status: ToolStatus | None = Query(default=None),
):
    tools = list_tools(category=category, risk_tier=risk_tier, status=status)
    return {"tools": [tool.model_dump(mode="json") for tool in tools], "count": len(tools)}


@router.post("/policy/evaluate")
async def evaluate_tool_policy(request: ToolPolicyRequest):
    decision = evaluate_policy(
        tool_id=request.tool_id,
        capability=request.capability,
        environment=request.environment,
        asset_authorized=request.asset_authorized,
        human_approved=request.human_approved,
        actor=request.actor,
    )
    return {
        "decision": decision.model_dump(mode="json"),
        "tool_execution_performed": False,
        "security_event_required_if_executed_later": True,
        "agent_action_log_required_if_executed_later": True,
    }


@router.post("/passive/virustotal/enrich")
async def enrich_with_virustotal(request: PassiveEnrichmentRequest, db=Depends(get_audit_db)):
    """Read-only reputation enrichment. This endpoint never initiates a scan."""
    try:
        result = await virustotal_enrich(
            request.indicator_type,
            request.indicator,
            audit_db=db,
        )
    except PassiveIntelError as exc:
        code = str(exc)
        if code in {
            "virustotal_not_configured",
            "audit_not_configured",
            "audit_unavailable",
            "audit_finalize_failed",
        }:
            raise HTTPException(status_code=503, detail=code) from exc
        if code == "indicator_not_found":
            raise HTTPException(status_code=404, detail=code) from exc
        if code in {"provider_rate_limited", "provider_timeout", "provider_unreachable"}:
            raise HTTPException(status_code=502, detail=code) from exc
        raise HTTPException(status_code=400, detail=code) from exc
    return {
        "result": result.as_dict(),
        "activity_class": "passive",
        "active_scan_performed": False,
        "audit_required": True,
        "audit_completed": True,
    }


@router.get("/graph/projection")
async def get_graph_projection():
    projection = graph_projection()
    return {
        **projection,
        "persistence_performed": False,
        "target_graph": "D3VONN Security Knowledge Graph",
    }


@router.get("/stix/projection")
async def get_stix_projection():
    return {
        "spec_version": "2.1",
        "custom_object_type": "x-d3vonn-security-tool",
        "objects": stix_projection(),
        "persistence_performed": False,
    }


@router.get("/{tool_id}")
async def get_tool_details(tool_id: str):
    tool = get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=404, detail="Cyber tool not found")
    return {"tool": tool.model_dump(mode="json"), "execution_enabled": False}
