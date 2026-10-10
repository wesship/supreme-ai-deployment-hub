"""FastAPI router for the Devonn.AI Agent Mesh API.

The router exposes canonical paths under the application's `/api/agents` mount.
Legacy `/api/agents/agents/*` aliases are retained temporarily for compatibility.
The governance dry-run endpoint is canonical-only and never executes providers.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..app.middleware.auth import get_current_user_id
from ..mesh.agent_mesh import AgentTask, AgentResult, TaskPriority, default_mesh
from .capability_bindings import AgentDryRunRequest, AgentDryRunResult, evaluate_agent_capability_dry_run
from .dispatch_audit import write_dispatch_audit
from .governance_context import resolve_agent_governance_context
from .governance_control import router as governance_control_router

logger = logging.getLogger(__name__)
router = APIRouter(tags=["agents"])
router.include_router(governance_control_router)


class DispatchRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    action: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=10)


class CapabilityDispatchRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    capability: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=10)


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


def _canary_run_id(payload: dict[str, Any]) -> str | None:
    value = payload.get("canary_run_id")
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:100] if value else None


async def _list_agents_impl() -> list[AgentInfo]:
    return [
        AgentInfo(name=name, base_url=client.reg.base_url, capabilities=client.reg.capabilities, status=client.status.value)
        for name, client in default_mesh._agents.items()
    ]


@router.get("/", response_model=list[AgentInfo])
@router.get("/agents/", response_model=list[AgentInfo], include_in_schema=False)
async def list_agents():
    return await _list_agents_impl()


@router.get("/health")
@router.get("/agents/health", include_in_schema=False)
async def health_check_all():
    results = await default_mesh.health_check_all()
    overall = all(results.values()) if results else False
    return {"overall": "healthy" if overall else "degraded", "agents": results}


@router.post("/governance/dry-run", response_model=GovernanceDryRunApiResponse)
async def governance_dry_run(request: GovernanceDryRunApiRequest, user_id: str = Depends(get_current_user_id)):
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
async def dispatch_task(request: DispatchRequest, user_id: str = Depends(get_current_user_id)):
    if not default_mesh.get_agent(request.agent_name):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{request.agent_name}' is not registered.")

    context = await resolve_agent_governance_context(
        workspace_id=request.workspace_id,
        user_id=user_id,
        agent_name=request.agent_name,
    )
    task = AgentTask(
        agent_name=request.agent_name,
        action=request.action,
        payload=request.payload,
        priority=request.priority,
        timeout_seconds=request.timeout_seconds,
        max_retries=request.max_retries,
    )
    run_id = _canary_run_id(request.payload)

    try:
        dry_run = evaluate_agent_capability_dry_run(
            AgentDryRunRequest(
                workspace_id=context.workspace_id,
                actor_id=context.actor_id,
                agent_name=request.agent_name,
                capability=request.action,
                workspace_permissions=context.permissions,
                approved_actions=context.approved_actions,
                disabled_agents=context.disabled_agents,
                kill_switch_enabled=context.kill_switch_enabled,
            )
        )
        decision = dry_run.governance.decision.value
        reason = dry_run.governance.reason
        missing_permissions = dry_run.governance.missing_permissions
    except (KeyError, PermissionError) as exc:
        decision = "deny"
        reason = str(exc)
        missing_permissions = []

    decision_data: dict[str, Any] = {
        "decision": decision,
        "reason": reason,
        "missing_permissions": missing_permissions,
        "priority": request.priority.value,
    }
    if run_id:
        decision_data["canary_run_id"] = run_id
    try:
        await write_dispatch_audit(
            workspace_id=context.workspace_id,
            actor_user_id=context.actor_id,
            event_type="agent_os.dispatch.decision",
            agent_name=request.agent_name,
            action=request.action,
            task_id=task.task_id,
            event_data=decision_data,
        )
    except Exception as exc:
        logger.exception("Mandatory pre-dispatch Agent OS audit failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dispatch blocked because governance audit evidence could not be recorded.",
        ) from exc

    if decision == "deny":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)
    if decision == "require_approval":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=reason)
    if decision != "allow":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Dispatch blocked by an unknown governance decision.")

    try:
        result = await default_mesh.dispatch(task)
    except Exception as exc:
        outcome_data: dict[str, Any] = {"success": False, "exception": type(exc).__name__}
        if run_id:
            outcome_data["canary_run_id"] = run_id
        try:
            await write_dispatch_audit(
                workspace_id=context.workspace_id,
                actor_user_id=context.actor_id,
                event_type="agent_os.dispatch.outcome",
                agent_name=request.agent_name,
                action=request.action,
                task_id=task.task_id,
                event_data=outcome_data,
            )
        except Exception:
            logger.exception("Post-dispatch exception audit failed for task %s", task.task_id)
        raise

    outcome_data = {
        "success": result.success,
        "error": result.error,
        "duration_ms": result.duration_ms,
        "retries_used": result.retries_used,
    }
    if run_id:
        outcome_data["canary_run_id"] = run_id
    try:
        await write_dispatch_audit(
            workspace_id=context.workspace_id,
            actor_user_id=context.actor_id,
            event_type="agent_os.dispatch.outcome",
            agent_name=request.agent_name,
            action=request.action,
            task_id=task.task_id,
            event_data=outcome_data,
        )
    except Exception:
        logger.exception("Post-dispatch outcome audit failed for task %s", task.task_id)

    if not result.success:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=result.error or "Agent task failed.")
    return result


@router.post("/capability", response_model=AgentResult)
@router.post("/agents/capability", response_model=AgentResult, include_in_schema=False)
async def dispatch_by_capability(request: CapabilityDispatchRequest, user_id: str = Depends(get_current_user_id)):
    candidates = default_mesh.find_by_capability(request.capability)
    for client in candidates:
        if await client.health_check():
            return await dispatch_task(
                DispatchRequest(
                    workspace_id=request.workspace_id,
                    agent_name=client.reg.name,
                    action=request.capability,
                    payload=request.payload,
                    priority=request.priority,
                    timeout_seconds=request.timeout_seconds,
                    max_retries=request.max_retries,
                ),
                user_id=user_id,
            )
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"No healthy agent with capability '{request.capability}'.")
