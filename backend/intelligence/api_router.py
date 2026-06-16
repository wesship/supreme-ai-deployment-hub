"""
Devonn.ai Intelligence Layer — API Router

Exposes the Prompt Engine, Tool Router, Agent Executor, Workflow Engine,
Memory, Orchestrator, and PRIMETIME Command Engine via FastAPI endpoints.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user_id
from app.middleware.rate_limit import rate_limit
from intelligence.commands import parse_command
from intelligence.executor.agent_executor import agent_executor
from intelligence.memory.memory import conversation_memory, long_term_memory
from intelligence.orchestration.orchestrator import orchestrator
from intelligence.plan_api2 import router as command_plan_router
from intelligence.prompts.engine import prompt_engine
from intelligence.router.router import tool_router
from intelligence.workflows.engine import workflow_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])
router.include_router(command_plan_router)


class RouteRequest(BaseModel):
    request: str
    context: str = ""


class ExecuteRequest(BaseModel):
    task: str
    context: Dict[str, Any] = {}
    session_id: Optional[str] = None


class OrchestrateRequest(BaseModel):
    goal: str
    context: Dict[str, Any] = {}
    session_id: Optional[str] = None


class WorkflowRunRequest(BaseModel):
    workflow_name: str
    context: Dict[str, Any] = {}


class MemoryStoreRequest(BaseModel):
    key: str
    value: Any
    ttl_seconds: Optional[int] = None


class MemoryRetrieveRequest(BaseModel):
    key: str


class CommandParseRequest(BaseModel):
    command: str = Field(min_length=1, max_length=8000)


@router.get("/prompts")
async def list_prompts(user_id: str = Depends(get_current_user_id)):
    return {"templates": list(prompt_engine._templates.keys())}


@router.post("/commands/parse")
@rate_limit(max_calls=60, window_seconds=60)
async def parse_primetime_command(
    body: CommandParseRequest,
    user_id: str = Depends(get_current_user_id),
):
    result = parse_command(body.command)
    logger.info(
        "PRIMETIME command parsed",
        extra={
            "user_id": user_id,
            "requested_codes": result["requestedCodes"],
            "approval_level": result["approvalLevel"],
            "human_approval_required": result["humanApprovalRequired"],
            "licensed_review_required": result["licensedReviewRequired"],
        },
    )
    return result


@router.post("/route")
@rate_limit(max_calls=30, window_seconds=60)
async def route_request(body: RouteRequest, user_id: str = Depends(get_current_user_id)):
    result = await tool_router.route_request(body.request, body.context)
    return result.model_dump()


@router.post("/execute")
@rate_limit(max_calls=10, window_seconds=60)
async def execute_task(body: ExecuteRequest, user_id: str = Depends(get_current_user_id)):
    result = await agent_executor.execute(body.task, body.context)
    return result.model_dump()


@router.post("/orchestrate")
@rate_limit(max_calls=5, window_seconds=60)
async def orchestrate_goal(body: OrchestrateRequest, user_id: str = Depends(get_current_user_id)):
    run = await orchestrator.run(
        goal=body.goal,
        user_id=user_id,
        session_id=body.session_id,
        context=body.context,
    )
    return run.model_dump()


@router.get("/orchestrate/{run_id}")
async def get_orchestration_run(run_id: str, user_id: str = Depends(get_current_user_id)):
    run = orchestrator.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run.model_dump()


@router.get("/workflows")
async def list_workflows(user_id: str = Depends(get_current_user_id)):
    return {"workflows": workflow_engine.list_workflows()}


@router.post("/workflows/run")
@rate_limit(max_calls=10, window_seconds=60)
async def run_workflow(body: WorkflowRunRequest, user_id: str = Depends(get_current_user_id)):
    try:
        run = await workflow_engine.execute(body.workflow_name, body.context)
        return run.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/memory/history/{session_id}")
async def get_conversation_history(
    session_id: str,
    max_messages: int = 20,
    user_id: str = Depends(get_current_user_id),
):
    history = conversation_memory.get_history(session_id, max_messages)
    return {"session_id": session_id, "messages": history}


@router.delete("/memory/history/{session_id}")
async def clear_conversation_history(session_id: str, user_id: str = Depends(get_current_user_id)):
    conversation_memory.clear_session(session_id)
    return {"cleared": True, "session_id": session_id}


@router.post("/memory/store")
async def store_memory(body: MemoryStoreRequest, user_id: str = Depends(get_current_user_id)):
    ok = await long_term_memory.store(body.key, body.value, user_id, body.ttl_seconds)
    return {"stored": ok, "key": body.key}


@router.post("/memory/retrieve")
async def retrieve_memory(body: MemoryRetrieveRequest, user_id: str = Depends(get_current_user_id)):
    value = await long_term_memory.retrieve(body.key, user_id)
    return {"key": body.key, "value": value, "found": value is not None}
