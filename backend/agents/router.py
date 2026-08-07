"""FastAPI router for the Devonn.AI Agent Mesh API.

The router exposes canonical paths under the application's `/api/agents` mount.
Legacy `/api/agents/agents/*` aliases are retained temporarily for compatibility.
The governance dry-run endpoint is canonical-only and never executes providers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any

from ..app.middleware.auth import get_current_user_id
from ..mesh.agent_mesh import AgentTask, AgentResult, default_mesh
from .capability_bindings import (
    AgentDryRunRequest,
    AgentDryRunResult,
    evaluate_agent_capability_dry_run,
)
from .governance_context import resolve_agent_governance_context

router = APIRouter(tags=["agents"])


class DispatchRequest(BaseModel):
    agent_name: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: str = "normal"
    timeout_seconds: int = 30
    max_retries: int = 3


class CapabilityDispatchRequest(BaseModel):
    capability: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class GovernanceDryRunApiRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    capability: str = Field(min_length=1)


class GovernanceDryRunApiResponse(BaseModel):
    workspace_id: str
    actor_id: str
    role: str
    capability: str
    agent_name: str
    decision: str
    reason: str
    missing_permissions: list[str] = Field(default_factory=list)
    executed: bool = False


class AgentInfo(BaseModel):
    name: str
    base_url: str
    capabilities: list[str]
    status: str


async def _list_agents_impl() -> list[AgentInfo]:
    return [
        AgentInfo(
            name=name,
            base_url=client.reg.base_url,
            capabilities=client.reg.capabilities,
            status=client.status.value,
        )
        for name, client in default_mesh._agents.items()
    ]


@router.get("/", response_model=list[AgentInfo])
@router.get("/agents/", response_model=list[AgentInfo], include_in_schema=False)
async def list_agents():
    """List all registered agents and their current status."""
    return await _list_agents_impl()


@router.get("/health")
@router.get("/agents/health", include_in_schema=False)
async def health_check_all():
    """Run health checks against all registered agents."""
    results = await default_mesh.health_check_all()
    overall = all(results.values()) if results else False
    return {"overall": "healthy" if overall else "degraded", "agents": results}


@router.post("/governance/dry-run", response_model=GovernanceDryRunApiResponse)
async def governance_dry_run(
    request: GovernanceDryRunApiRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Evaluate server-resolved Agent OS policy without executing anything."""
    context = await resolve_agent_governance_context(
        workspace_id=request.workspace_id,
        user_id=user_id,
        agent_name=request.agent_name,
    )

    try:
        result: AgentDryRunResult = evaluate_agent_capability_dry_run(
            AgentDryRunRequest(
                workspace_id=context.workspace_id,
                actor_id=context.actor_id,
                agent_name=request.agent_name,
                capability=request.capability,
                workspace_permissions=context.permissions,
                approved_actions=context.approved_actions,
                disabled_agents=context.disabled_agents,
                kill_switch_enabled=context.kill_switch_enabled,
            )
        )
    except (KeyError, PermissionError) as exc:
        return GovernanceDryRunApiResponse(
            workspace_id=context.workspace_id,
            actor_id=context.actor_id,
            role=context.role,
            capability=request.capability,
            agent_name=request.agent_name,
            decision="deny",
            reason=str(exc),
            executed=False,
        )

    return GovernanceDryRunApiResponse(
        workspace_id=context.workspace_id,
        actor_id=context.actor_id,
        role=context.role,
        capability=result.capability,
        agent_name=result.agent_name,
        decision=result.governance.decision.value,
        reason=result.governance.reason,
        missing_permissions=result.governance.missing_permissions,
        executed=False,
    )


@router.post("/dispatch", response_model=AgentResult)
@router.post("/agents/dispatch", response_model=AgentResult, include_in_schema=False)
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
@router.post("/agents/capability", response_model=AgentResult, include_in_schema=False)
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
