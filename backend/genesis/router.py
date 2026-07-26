"""Genesis production operating system API routes."""
from __future__ import annotations

import hashlib
from typing import Annotated, Any
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from .auth import GenesisPrincipal, require_genesis_user
from .quality import quality_service
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


# Mounted by backend.app.routers.proxy_router, which already owns the /api prefix.
router = APIRouter(prefix="/genesis", tags=["genesis"])
Principal = Annotated[GenesisPrincipal, Depends(require_genesis_user)]


@router.get("/health")
async def genesis_health() -> dict[str, Any]:
    # A successful table read proves both persistence credentials and the Genesis schema.
    # Production does not receive these migrations until the separate promotion change.
    await service.repo._request(
        "GET",
        "genesis_projects",
        params={"select": "id", "limit": "1"},
    )
    return {
        "status": "ok",
        "version": "1.0.0",
        "components": {
            "data_model": "ready",
            "workflow_runtime": "ready",
            "render_gateway": "adapter_ready",
            "quality_framework": "ready",
            "creator_api": "ready",
        },
    }


@router.get("/runtime-config")
async def genesis_runtime_config() -> dict[str, Any]:
    """Temporary non-secret fingerprint used to verify staging environment binding."""
    key = service.repo.service_key
    hostname = urlparse(service.repo.base_url).hostname or ""
    project_ref = hostname.split(".", 1)[0] if hostname else None
    key_kind = "opaque" if key.startswith("sb_") else "legacy_jwt" if key.startswith("eyJ") else "unknown"
    fingerprint = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12] if key else None
    return {
        "status": "diagnostic",
        "marker": "genesis-key-diagnostic-v1",
        "supabase_project_ref": project_ref,
        "service_key_kind": key_kind,
        "service_key_fingerprint": fingerprint,
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


@router.post("/projects/{project_id}/evaluate", status_code=status.HTTP_201_CREATED)
async def evaluate_project(project_id: UUID, principal: Principal) -> dict[str, Any]:
    return await quality_service.run(project_id, principal.user_id)


@router.get("/projects/{project_id}/evaluations")
async def list_project_evaluations(
    project_id: UUID,
    principal: Principal,
    limit: int = Query(default=25, ge=1, le=100),
) -> dict[str, Any]:
    evaluations = await service.repo.list_rows(
        "genesis_evaluation_runs",
        project_id,
        principal.user_id,
        limit=limit,
    )
    latest_id = str(evaluations[0]["id"]) if evaluations else None
    latest_filter = {"evaluation_run_id": f"eq.{latest_id}"} if latest_id else {"id": "is.null"}
    findings = await service.repo.list_rows(
        "genesis_findings",
        project_id,
        principal.user_id,
        limit=200,
        extra_params=latest_filter,
    )
    gates = await service.repo.list_rows(
        "genesis_release_gates",
        project_id,
        principal.user_id,
        order="updated_at.desc",
        limit=100,
        extra_params=latest_filter,
    )
    return {"evaluations": evaluations, "findings": findings, "gates": gates}


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: UUID,
    body: ApprovalDecisionRequest,
    principal: Principal,
) -> dict[str, Any]:
    approval = await service.decide_approval(approval_id, body, principal.user_id)
    return {"approval": approval}
