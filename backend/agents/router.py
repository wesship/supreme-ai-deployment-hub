"""
router.py — FastAPI router for the D3VONN Agent Mesh API

Exposes the agent mesh as REST endpoints that the React frontend
(and the Chrome extension) can call.

Endpoints:
  GET  /agents/             — List all registered agents and their status
  GET  /agents/health       — Health check all agents
  POST /agents/dispatch     — Dispatch a task to a named agent
  POST /agents/capability   — Dispatch to the best agent for a capability
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Any

from ..mesh.agent_mesh import AgentTask, AgentResult, default_mesh

router = APIRouter(prefix="/agents", tags=["agents"])


# ── Request / Response Models ─────────────────────────────────────────────────

class DispatchRequest(BaseModel):
    agent_name: str
    action: str
    payload: dict[str, Any] = {}
    priority: str = "normal"
    timeout_seconds: int = 30
    max_retries: int = 3


class CapabilityDispatchRequest(BaseModel):
    capability: str
    action: str
    payload: dict[str, Any] = {}


class AgentInfo(BaseModel):
    name: str
    base_url: str
    capabilities: list[str]
    status: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[AgentInfo])
async def list_agents():
    """List all registered agents and their current status."""
    return [
        AgentInfo(
            name=name,
            base_url=client.reg.base_url,
            capabilities=client.reg.capabilities,
            status=client.status.value,
        )
        for name, client in default_mesh._agents.items()
    ]


@router.get("/health")
async def health_check_all():
    """Run health checks against all registered agents."""
    results = await default_mesh.health_check_all()
    overall = all(results.values()) if results else False
    return {
        "overall": "healthy" if overall else "degraded",
        "agents": results,
    }


@router.post("/dispatch", response_model=AgentResult)
async def dispatch_task(request: DispatchRequest):
    """Dispatch a task to a specific named agent."""
    if not default_mesh.get_agent(request.agent_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{request.agent_name}' is not registered.",
        )

    task = AgentTask(
        agent_name=request.agent_name,
        action=request.action,
        payload=request.payload,
        timeout_seconds=request.timeout_seconds,
        max_retries=request.max_retries,
    )
    result = await default_mesh.dispatch(task)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.error or "Agent task failed.",
        )
    return result


@router.post("/capability", response_model=AgentResult)
async def dispatch_by_capability(request: CapabilityDispatchRequest):
    """Dispatch a task to the best available agent with the given capability."""
    result = await default_mesh.dispatch_to_capable(
        capability=request.capability,
        action=request.action,
        payload=request.payload,
    )
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.error or f"No healthy agent with capability '{request.capability}'.",
        )
    return result
