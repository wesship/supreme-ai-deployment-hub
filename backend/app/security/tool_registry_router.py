"""Read-only API for the D3VONN Cyber Tool Registry.

This router returns registry metadata, policy decisions, and graph/STIX
projections. It does not execute security tools or initiate scans.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

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
        "mode": "metadata_and_policy_only",
        "tool_count": len(tools),
        "risk_counts": risk_counts,
        "status_counts": status_counts,
        "tool_execution_enabled": False,
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
    return {
        "tools": [tool.model_dump(mode="json") for tool in tools],
        "count": len(tools),
        "execution_enabled": False,
    }


@router.post("/policy/evaluate")
async def evaluate_tool_policy(request: ToolPolicyRequest):
    """Evaluate authorization metadata only; never execute the selected tool."""
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
    return {
        "tool": tool.model_dump(mode="json"),
        "execution_enabled": False,
    }
