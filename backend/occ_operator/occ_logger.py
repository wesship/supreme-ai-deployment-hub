"""
backend/operator/occ_logger.py — Non-blocking OCC event logging service.

Provides helper functions that write production events into the 7 Supabase
OCC tables. All functions are:
  - Non-blocking: run as asyncio background tasks so logging never slows
    down user-facing requests.
  - Failure-safe: any Supabase error is caught and logged to stderr only;
    it never raises or crashes the calling request.
  - Secret-safe: uses SUPABASE_SERVICE_ROLE_KEY server-side only.

Usage:
    from backend.occ_operator.occ_logger import (
        log_ai_request, log_tool_call, log_agent_activity,
        log_error, create_approval_request, log_rag_document,
        upsert_user_plan,
    )

    # In an async route or service:
    await log_ai_request(model="gpt-4o", prompt_tokens=120, ...)

    # Or fire-and-forget (non-blocking):
    asyncio.create_task(log_ai_request(...))
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import traceback
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import httpx

from backend.occ_operator.occ_models import (
    AgentActivityLogInsert,
    AIRequestLogInsert,
    ApprovalQueueInsert,
    ErrorLogInsert,
    RAGDocumentInsert,
    ToolCallLogInsert,
    UserPlanUpsert,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — read at call time so tests can patch env vars freely
# ---------------------------------------------------------------------------
_TIMEOUT = 8.0  # seconds — generous but bounded


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _service_role_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _headers() -> dict[str, str]:
    key = _service_role_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",  # don't return the inserted row (faster)
    }


def _is_configured() -> bool:
    return bool(_supabase_url() and _service_role_key())


# ---------------------------------------------------------------------------
# Core insert helper
# ---------------------------------------------------------------------------
async def _insert(table: str, payload: Dict[str, Any]) -> bool:
    """
    Insert a single row into a Supabase table via the REST API.
    Returns True on success, False on any error (never raises).
    """
    if not _is_configured():
        logger.debug("[occ_logger] Supabase not configured — skipping insert into %s", table)
        return False

    # Remove None values so Supabase uses column defaults
    clean = {k: v for k, v in payload.items() if v is not None}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{_supabase_url()}/rest/v1/{table}",
                headers=_headers(),
                json=clean,
            )
            if resp.status_code in (200, 201):
                return True
            logger.warning(
                "[occ_logger] Insert into %s failed: %s %s",
                table, resp.status_code, resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.warning("[occ_logger] Insert into %s raised: %s", table, exc)
        return False


async def _upsert(table: str, payload: Dict[str, Any], on_conflict: str) -> bool:
    """
    Upsert a row into a Supabase table (INSERT ... ON CONFLICT DO UPDATE).
    Returns True on success, False on any error (never raises).
    """
    if not _is_configured():
        return False

    clean = {k: v for k, v in payload.items() if v is not None}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{_supabase_url()}/rest/v1/{table}",
                headers={
                    **_headers(),
                    "Prefer": f"resolution=merge-duplicates,return=minimal",
                },
                params={"on_conflict": on_conflict},
                json=clean,
            )
            if resp.status_code in (200, 201):
                return True
            logger.warning(
                "[occ_logger] Upsert into %s failed: %s %s",
                table, resp.status_code, resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.warning("[occ_logger] Upsert into %s raised: %s", table, exc)
        return False


# ---------------------------------------------------------------------------
# Public logging API
# ---------------------------------------------------------------------------

async def log_ai_request(
    model: str,
    *,
    provider: str = "openai",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
    latency_ms: Optional[int] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    request_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Log an LLM API call to ai_request_logs. Non-blocking, failure-safe."""
    row = AIRequestLogInsert(
        model=model,
        provider=provider,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
        request_id=request_id,
        endpoint=endpoint,
        user_id=user_id,
        tenant_id=tenant_id,
        metadata=metadata or {},
    )
    return await _insert("ai_request_logs", row.model_dump())


async def log_tool_call(
    agent_id: str,
    tool_name: str,
    *,
    session_id: Optional[str] = None,
    tool_input: Optional[Dict[str, Any]] = None,
    tool_output: Optional[Dict[str, Any]] = None,
    status: str = "success",
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Log an agent tool invocation to tool_call_logs. Non-blocking, failure-safe."""
    row = ToolCallLogInsert(
        agent_id=agent_id,
        tool_name=tool_name,
        session_id=session_id,
        tool_input=tool_input or {},
        tool_output=tool_output or {},
        status=status,
        duration_ms=duration_ms,
        error_message=error_message,
        user_id=user_id,
        tenant_id=tenant_id,
        metadata=metadata or {},
    )
    return await _insert("tool_call_logs", row.model_dump())


async def log_agent_activity(
    agent_id: str,
    event_type: str,
    *,
    agent_name: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    duration_ms: Optional[int] = None,
    tokens_used: int = 0,
    cost_usd: float = 0.0,
    status: str = "success",
    error_message: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Log an agent lifecycle event to agent_activity_logs. Non-blocking, failure-safe."""
    row = AgentActivityLogInsert(
        agent_id=agent_id,
        event_type=event_type,
        agent_name=agent_name,
        session_id=session_id,
        user_id=user_id,
        tenant_id=tenant_id,
        duration_ms=duration_ms,
        tokens_used=tokens_used,
        cost_usd=cost_usd,
        status=status,
        error_message=error_message,
        payload=payload or {},
        metadata=metadata or {},
    )
    return await _insert("agent_activity_logs", row.model_dump())


async def log_error(
    error_type: str,
    message: str,
    *,
    severity: str = "error",
    stack_trace: Optional[str] = None,
    service: str = "backend",
    endpoint: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Log a backend error to error_logs. Non-blocking, failure-safe."""
    row = ErrorLogInsert(
        error_type=error_type,
        message=message,
        severity=severity,
        stack_trace=stack_trace,
        service=service,
        endpoint=endpoint,
        user_id=user_id,
        tenant_id=tenant_id,
        request_id=request_id,
        resolved=False,
        occurrence_count=1,
        metadata=metadata or {},
    )
    return await _insert("error_logs", row.model_dump())


async def create_approval_request(
    title: str,
    action_type: str,
    *,
    description: Optional[str] = None,
    requested_by: Optional[str] = None,
    priority: str = "normal",
    expires_at: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Create a human-in-the-loop approval request in approval_queue. Non-blocking, failure-safe."""
    row = ApprovalQueueInsert(
        title=title,
        action_type=action_type,
        description=description,
        requested_by=requested_by,
        status="pending",
        priority=priority,
        expires_at=expires_at,
        payload=payload or {},
        tenant_id=tenant_id,
        metadata=metadata or {},
    )
    return await _insert("approval_queue", row.model_dump())


async def log_rag_document(
    title: str,
    *,
    description: Optional[str] = None,
    file_name: Optional[str] = None,
    file_type: Optional[str] = None,
    file_size_bytes: Optional[int] = None,
    storage_path: Optional[str] = None,
    public_url: Optional[str] = None,
    status: str = "processing",
    chunk_count: int = 0,
    embedding_model: str = "text-embedding-3-small",
    namespace: str = "default",
    tags: Optional[list[str]] = None,
    uploaded_by: Optional[str] = None,
    tenant_id: Optional[str] = None,
    indexed_at: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Insert or update a RAG document record in rag_documents. Non-blocking, failure-safe."""
    row = RAGDocumentInsert(
        title=title,
        description=description,
        file_name=file_name,
        file_type=file_type,
        file_size_bytes=file_size_bytes,
        storage_path=storage_path,
        public_url=public_url,
        status=status,
        chunk_count=chunk_count,
        embedding_model=embedding_model,
        namespace=namespace,
        tags=tags or [],
        uploaded_by=uploaded_by,
        tenant_id=tenant_id,
        indexed_at=indexed_at,
        error_message=error_message,
        metadata=metadata or {},
    )
    return await _insert("rag_documents", row.model_dump())


async def upsert_user_plan(
    user_id: str,
    *,
    plan_name: str = "free",
    plan_tier: int = 0,
    status: str = "active",
    tokens_limit: int = 100_000,
    tokens_used: int = 0,
    requests_limit: int = 1_000,
    requests_used: int = 0,
    billing_period: str = "monthly",
    trial_ends_at: Optional[str] = None,
    reset_at: Optional[str] = None,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Upsert a user plan record in user_plans (keyed on user_id). Non-blocking, failure-safe."""
    row = UserPlanUpsert(
        user_id=user_id,
        plan_name=plan_name,
        plan_tier=plan_tier,
        status=status,
        tokens_limit=tokens_limit,
        tokens_used=tokens_used,
        requests_limit=requests_limit,
        requests_used=requests_used,
        billing_period=billing_period,
        trial_ends_at=trial_ends_at,
        reset_at=reset_at,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id,
        metadata=metadata or {},
    )
    return await _upsert("user_plans", row.model_dump(), on_conflict="user_id")


# ---------------------------------------------------------------------------
# Context manager: time a block and log the result as an AI request
# ---------------------------------------------------------------------------
@asynccontextmanager
async def timed_ai_request(
    model: str,
    endpoint: str = "/api/chat",
    **log_kwargs: Any,
):
    """
    Async context manager that measures latency and logs an AI request.

    Usage:
        async with timed_ai_request("gpt-4o", endpoint="/api/chat") as ctx:
            response = await openai_client.chat.completions.create(...)
            ctx["prompt_tokens"] = response.usage.prompt_tokens
            ctx["completion_tokens"] = response.usage.completion_tokens
            ctx["total_tokens"] = response.usage.total_tokens
            ctx["cost_usd"] = calculate_cost(response)
    """
    ctx: Dict[str, Any] = {"status": "success", **log_kwargs}
    start = time.monotonic()
    try:
        yield ctx
    except Exception as exc:
        ctx["status"] = "error"
        ctx["error_message"] = str(exc)
        raise
    finally:
        latency_ms = int((time.monotonic() - start) * 1000)
        asyncio.create_task(
            log_ai_request(
                model=model,
                endpoint=endpoint,
                latency_ms=latency_ms,
                **ctx,
            )
        )


# ---------------------------------------------------------------------------
# Convenience: fire-and-forget wrappers (synchronous callers)
# ---------------------------------------------------------------------------
def fire_log_error(
    error_type: str,
    message: str,
    exc: Optional[BaseException] = None,
    **kwargs: Any,
) -> None:
    """
    Schedule an error log as a background task from synchronous or async code.
    Safe to call from exception handlers where you cannot await.
    """
    stack = traceback.format_exc() if exc else None
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(
                log_error(
                    error_type=error_type,
                    message=message,
                    stack_trace=stack,
                    **kwargs,
                )
            )
    except RuntimeError:
        # No event loop — log to stderr only
        logger.error("[occ_logger] fire_log_error: %s — %s", error_type, message)
