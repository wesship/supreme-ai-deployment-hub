"""
Devonn.ai Intelligence Layer — API Router

Exposes the Prompt Engine, Tool Router, Agent Executor, Workflow Engine,
Memory, and Orchestrator via FastAPI endpoints under /api/intelligence.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit
from .executor.agent_executor import agent_executor
from .memory.memory import conversation_memory, long_term_memory
from .orchestration.orchestrator import orchestrator
from .prompts.engine import prompt_engine
from .router.router import tool_router
from .workflows.engine import workflow_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


# ── Request / Response Models ─────────────────────────────────────────────────

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


# ── Prompt Engine ─────────────────────────────────────────────────────────────

@router.get("/prompts")
async def list_prompts(user_id: str = Depends(get_current_user_id)):
    """List all registered prompt templates."""
    return {
        "templates": list(prompt_engine._templates.keys())
    }


# ── Tool Router ───────────────────────────────────────────────────────────────

@router.post("/route")
async def route_request(
    body: RouteRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(30)),
):
    """Route a user request to the best tool."""
    result = await tool_router.route_request(body.request, body.context)
    return result.model_dump()


# ── Agent Executor ────────────────────────────────────────────────────────────

@router.post("/execute")
async def execute_task(
    body: ExecuteRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
):
    """Execute a task autonomously using the agent executor."""
    result = await agent_executor.execute(body.task, body.context)
    return result.model_dump()


# ── Orchestrator ──────────────────────────────────────────────────────────────

@router.post("/orchestrate")
async def orchestrate_goal(
    body: OrchestrateRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(5)),
):
    """Orchestrate a complex goal using multi-agent coordination."""
    run = await orchestrator.run(
        goal=body.goal,
        user_id=user_id,
        session_id=body.session_id,
        context=body.context
    )
    return run.model_dump()


@router.get("/orchestrate/{run_id}")
async def get_orchestration_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get the status of an orchestration run."""
    run = orchestrator.get_run(run_id)
    if run is None or run.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run.model_dump()


# ── Workflow Engine ───────────────────────────────────────────────────────────

@router.get("/workflows")
async def list_workflows(user_id: str = Depends(get_current_user_id)):
    """List all registered workflows."""
    return {"workflows": workflow_engine.list_workflows()}


@router.post("/workflows/run")
async def run_workflow(
    body: WorkflowRunRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
):
    """Execute a registered workflow by name."""
    try:
        run = await workflow_engine.execute(body.workflow_name, body.context)
        return run.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Memory ────────────────────────────────────────────────────────────────────

@router.get("/memory/history/{session_id}")
async def get_conversation_history(
    session_id: str,
    max_messages: int = 20,
    user_id: str = Depends(get_current_user_id)
):
    """Get conversation history for a session."""
    history = conversation_memory.get_history(session_id, max_messages)
    return {"session_id": session_id, "messages": history}


@router.delete("/memory/history/{session_id}")
async def clear_conversation_history(
    session_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Clear conversation history for a session."""
    conversation_memory.clear_session(session_id)
    return {"cleared": True, "session_id": session_id}


@router.post("/memory/store")
async def store_memory(
    body: MemoryStoreRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Store a key-value fact in long-term memory."""
    ok = await long_term_memory.store(body.key, body.value, user_id, body.ttl_seconds)
    return {"stored": ok, "key": body.key}


@router.post("/memory/retrieve")
async def retrieve_memory(
    body: MemoryRetrieveRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve a value from long-term memory."""
    value = await long_term_memory.retrieve(body.key, user_id)
    return {"key": body.key, "value": value, "found": value is not None}
