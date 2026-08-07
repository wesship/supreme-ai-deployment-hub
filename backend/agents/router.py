"""Governed FastAPI router for the Devonn.AI Agent Mesh API."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..app.middleware.auth import get_current_user_id
from ..app.routers.primetime_release1 import _audit
from ..mesh.agent_mesh import AgentTask, AgentResult, default_mesh
from .capability_bindings import AgentDryRunRequest, AgentDryRunResult, evaluate_agent_capability_dry_run
from .governance import GovernanceDecision
from .governance_context import resolve_agent_governance_context
from .governance_control import router as governance_control_router

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agents", tags=["agents"])
router.include_router(governance_control_router)


class DispatchRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    action: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: str = "normal"
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=5)


class CapabilityDispatchRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    capability: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: str = "normal"
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=5)


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


@router.get("/", response_model=list[AgentInfo])
async def list_agents():
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
    results = await default_mesh.health_check_all()
    overall = all(results.values()) if results else False
    return {"overall": "healthy" if overall else "degraded", "agents": results}


async def _evaluate_governed_action(
    *, workspace_id: str, user_id: str, agent_name: str, capability: str
) -> tuple[AgentDryRunResult | None, Any, str | None]:
    context = await resolve_agent_governance_context(
        workspace_id=workspace_id,
        user_id=user_id,
        agent_name=agent_name,
    )
    try:
        result = evaluate_agent_capability_dry_run(
            AgentDryRunRequest(
                workspace_id=context.workspace_id,
                actor_id=context.actor_id,
                agent_name=agent_name,
                capability=capability,
                workspace_permissions=context.permissions,
                approved_actions=context.approved_actions,
                disabled_agents=context.disabled_agents,
                kill_switch_enabled=context.kill_switch_enabled,
            )
        )
        return result, context, None
    except (KeyError, PermissionError) as exc:
        return None, context, str(exc)


async def _audit_outcome_best_effort(
    *, context: Any, task: AgentTask, result: AgentResult
) -> None:
    """Record provider outcome without turning an already-executed task ambiguous."""
    try:
        await _audit(
            context.workspace_id,
            context.actor_id,
            "agent_os.dispatch.outcome",
            "agent_dispatch",
            task.task_id,
            {
                "agent_name": task.agent_name,
                "capability": task.action,
                "success": result.success,
                "duration_ms": result.duration_ms,
                "retries_used": result.retries_used,
                "error_present": bool(result.error),
            },
        )
    except Exception:
        logger.exception("Agent OS outcome audit failed for task %s", task.task_id)


async def _govern_and_dispatch(
    *,
    workspace_id: str,
    user_id: str,
    agent_name: str,
    capability: str,
    payload: dict[str, Any],
    priority: str,
    timeout_seconds: int,
    max_retries: int,
) -> AgentResult:
    if not default_mesh.get_agent(agent_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_name}' is not registered.",
        )

    result, context, closed_reason = await _evaluate_governed_action(
        workspace_id=workspace_id,
        user_id=user_id,
        agent_name=agent_name,
        capability=capability,
    )
    decision = GovernanceDecision.DENY.value if result is None else result.governance.decision.value
    reason = (
        (closed_reason or "governance evaluation failed closed")
        if result is None
        else result.governance.reason
    )
    missing_permissions = [] if result is None else result.governance.missing_permissions

    task = AgentTask(
        agent_name=agent_name,
        action=capability,
        payload=payload,
        priority=priority,
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
    )

    # Decision evidence is mandatory before execution. An audit outage fails closed.
    await _audit(
        context.workspace_id,
        context.actor_id,
        "agent_os.dispatch.decision",
        "agent_dispatch",
        task.task_id,
        {
            "agent_name": agent_name,
            "capability": capability,
            "decision": decision,
            "reason": reason,
            "role": context.role,
            "missing_permissions": missing_permissions,
        },
    )

    if result is None or result.governance.decision is GovernanceDecision.DENY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"decision": "deny", "reason": reason, "executed": False},
        )
    if result.governance.decision is GovernanceDecision.REQUIRE_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"decision": "require_approval", "reason": reason, "executed": False},
        )

    mesh_result = await default_mesh.dispatch(task)
    await _audit_outcome_best_effort(context=context, task=task, result=mesh_result)
    if not mesh_result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=mesh_result.error or "Agent task failed.",
        )
    return mesh_result


@router.post("/governance/dry-run", response_model=GovernanceDryRunApiResponse)
async def governance_dry_run(
    request: GovernanceDryRunApiRequest,
    user_id: str = Depends(get_current_user_id),
):
    result, context, closed_reason = await _evaluate_governed_action(
        workspace_id=request.workspace_id,
        user_id=user_id,
        agent_name=request.agent_name,
        capability=request.capability,
    )
    if result is None:
        return GovernanceDryRunApiResponse(
            workspace_id=context.workspace_id,
            actor_id=context.actor_id,
            role=context.role,
            capability=request.capability,
            agent_name=request.agent_name,
            decision="deny",
            reason=closed_reason or "governance evaluation failed closed",
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
async def dispatch_task(
    request: DispatchRequest,
    user_id: str = Depends(get_current_user_id),
):
    return await _govern_and_dispatch(
        workspace_id=request.workspace_id,
        user_id=user_id,
        agent_name=request.agent_name,
        capability=request.action,
        payload=request.payload,
        priority=request.priority,
        timeout_seconds=request.timeout_seconds,
        max_retries=request.max_retries,
    )


@router.post("/capability", response_model=AgentResult)
async def dispatch_by_capability(
    request: CapabilityDispatchRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Select a healthy capable agent, then apply the same governance as named dispatch."""
    candidates = default_mesh.find_by_capability(request.capability)
    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered agent has capability '{request.capability}'.",
        )

    for client in candidates:
        if not await client.health_check():
            continue
        return await _govern_and_dispatch(
            workspace_id=request.workspace_id,
            user_id=user_id,
            agent_name=client.reg.name,
            capability=request.capability,
            payload=request.payload,
            priority=request.priority,
            timeout_seconds=request.timeout_seconds,
            max_retries=request.max_retries,
        )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"No healthy agent found with capability '{request.capability}'.",
    )
