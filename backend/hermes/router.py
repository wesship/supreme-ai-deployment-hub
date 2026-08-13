"""
Hermes Task Engine Router
/api/hermes/tasks/*  — task CRUD, state transitions, agent dispatch
All endpoints require a valid Supabase admin/operator JWT.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import require_occ_access
from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import (
    create_task,
    get_task,
    list_tasks,
    transition_task,
    dispatch_to_agent,
    TASK_STATES,
    AGENT_HIERARCHY,
)

router = APIRouter(prefix="/api/hermes/tasks", tags=["hermes-tasks"])

class CreateTaskRequest(BaseModel):
    title: str
    task_type: str = "generic"
    description: Optional[str] = None
    agent_name: Optional[str] = None
    input_data: Optional[dict] = None
    parent_task_id: Optional[str] = None
    priority: int = Field(default=5, ge=1, le=10)
    source: str = "api"
    scheduled_at: Optional[str] = None
    deadline_at: Optional[str] = None
    correlation_id: Optional[str] = None

class TransitionRequest(BaseModel):
    new_status: str
    output_data: Optional[dict] = None
    error_message: Optional[str] = None
    agent_name: Optional[str] = None

class DispatchRequest(BaseModel):
    agent_name: str
    input_data: Optional[dict] = None

@router.get("/agents")
async def list_agents(_: Any = Depends(require_occ_access)):
    return {"agents": AGENT_HIERARCHY}

@router.get("/states")
async def list_states(_: Any = Depends(require_occ_access)):
    return {"states": sorted(TASK_STATES)}

@router.get("")
async def get_tasks(status: Optional[str] = Query(None), agent_name: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200), _: Any = Depends(require_occ_access)):
    if status and status not in TASK_STATES:
        raise HTTPException(400, f"Invalid status. Must be one of: {sorted(TASK_STATES)}")
    tasks = await list_tasks(status=status, agent_name=agent_name, limit=limit)
    return {"tasks": tasks, "count": len(tasks)}

@router.post("", status_code=201)
async def create_new_task(body: CreateTaskRequest, _: Any = Depends(require_occ_access)):
    if body.agent_name and body.agent_name not in AGENT_HIERARCHY:
        raise HTTPException(400, f"Unknown agent '{body.agent_name}'. Valid: {list(AGENT_HIERARCHY)}")
    task = await create_task(**body.model_dump(exclude_none=True))
    return {"task": task}

@router.get("/{task_id}")
async def get_single_task(task_id: str, _: Any = Depends(require_occ_access)):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(404, f"Task {task_id} not found")
    return {"task": task}

@router.patch("/{task_id}/transition")
async def transition(task_id: str, body: TransitionRequest, _: Any = Depends(require_occ_access)):
    try:
        updated = await transition_task(
            task_id=task_id,
            new_status=body.new_status,
            output_data=body.output_data,
            error_message=body.error_message,
            agent_name=body.agent_name,
        )
        if body.new_status.upper() in {"COMPLETED", "FAILED", "CANCELLED"}:
            from backend.ai_films.hermes_task_event_bridge import advance_ai_film_for_task
            await advance_ai_film_for_task(task_id, get_dependencies())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"task": updated}

@router.post("/{task_id}/dispatch")
async def dispatch(task_id: str, body: DispatchRequest, _: Any = Depends(require_occ_access)):
    task = await get_task(task_id)
    if not task:
        raise HTTPException(404, f"Task {task_id} not found")
    try:
        result = await dispatch_to_agent(agent_name=body.agent_name, task_id=task_id, input_data=body.input_data)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"dispatch_result": result}
