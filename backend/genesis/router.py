"""Genesis production operating system API routes."""
from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from .auth import GenesisPrincipal, require_genesis_user
from .render_gateway import public_provider_health
from .schemas import (
    ApprovalDecisionRequest,
    BootstrapWorkflowRequest,
    CreateCanonEntryRequest,
    CreateGoalRequest,
    CreateProjectRequest,
    CreateRenderRequest,
    TransitionTaskRequest,
)
from .service import service


router = APIRouter(prefix="/api/genesis", tags=["genesis"])
Principal = Annotated[GenesisPrincipal, Depends(require_genesis_user)]


@router.get("/health")
async def genesis_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": "1.0.0",
        "components": {
            "data_model": "migration_ready",
            "workflow_runtime": "ready",
            "render_gateway": "adapter_ready",
            "creator_api": "ready",
        },
    }


@router.get("/providers")
async def list_provider_health(_: Principal) -> dict[str, Any]:
    routes = public_provider_health()
    return {"providers": routes, "configured": sum(1 for route in routes if route["configured"])}


@router.get("/projects")
async def list_projects(principal: Principal) -> dict[str, Any]:
    projects = await service.list_projects(principal.user_id)
    return {"projects": projects, "count": len(projects)}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(body: CreateProjectRequest, principal: Principal) -> dict[str, Any]:
    project = await service.create_project(body, principal.user_id)
    return {"project": project}


@router.get("/projects/{project_id}/command-center")
async def get_command_center(project_id: UUID, principal: Principal) -> dict[str, Any]:
    return await service.command_center(project_id, principal.user_id)


@router.get("/projects/{project_id}/snapshot")
async def get_project_snapshot(project_id: UUID, principal: Principal) -> dict[str, Any]:
    return await service.snapshot(project_id, principal.user_id)


@router.post("/projects/{project_id}/canon", status_code=status.HTTP_201_CREATED)
async def create_canon_entry(
    project_id: UUID,
    body: CreateCanonEntryRequest,
    principal: Principal,
) -> dict[str, Any]:
    entry = await service.create_canon(project_id, body, principal.user_id)
    return {"canon_entry": entry}


@router.post("/projects/{project_id}/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(
    project_id: UUID,
    body: CreateGoalRequest,
    principal: Principal,
) -> dict[str, Any]:
    goal = await service.create_goal(project_id, body, principal.user_id)
    return {"goal": goal}


@router.post("/projects/{project_id}/workflows/bootstrap", status_code=status.HTTP_201_CREATED)
async def bootstrap_project(
    project_id: UUID,
    body: BootstrapWorkflowRequest,
    principal: Principal,
) -> dict[str, Any]:
    return await service.bootstrap_workflow(project_id, body, principal.user_id)


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    project_id: UUID,
    principal: Principal,
    task_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict[str, Any]:
    params = {"status": f"eq.{task_status}"} if task_status else None
    tasks = await service.repo.list_rows(
        "genesis_tasks",
        project_id,
        principal.user_id,
        limit=limit,
        extra_params=params,
    )
    return {"tasks": tasks, "count": len(tasks)}


@router.patch("/tasks/{task_id}/transition")
async def transition_task(
    task_id: UUID,
    body: TransitionTaskRequest,
    principal: Principal,
) -> dict[str, Any]:
    task = await service.transition_task(task_id, body, principal.user_id)
    return {"task": task}


@router.post("/projects/{project_id}/render-requests", status_code=status.HTTP_201_CREATED)
async def create_render_request(
    project_id: UUID,
    body: CreateRenderRequest,
    principal: Principal,
) -> dict[str, Any]:
    return await service.create_render_request(project_id, body, principal.user_id)


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: UUID,
    body: ApprovalDecisionRequest,
    principal: Principal,
) -> dict[str, Any]:
    approval = await service.decide_approval(approval_id, body, principal.user_id)
    return {"approval": approval}
