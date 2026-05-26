"""
Operator Command Center — structured logging service.
Inserts records into Supabase OCC tables via the REST API.
All calls are fire-and-forget (background tasks) so they never
block the main request path.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Optional

import httpx

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _headers() -> dict[str, str]:
    return {
        "apikey": _SERVICE_KEY,
        "Authorization": f"Bearer {_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


async def _insert(table: str, payload: dict) -> None:
    """Fire-and-forget async insert into a Supabase table."""
    if not _SUPABASE_URL or not _SERVICE_KEY:
        return  # skip if not configured (dev / test)
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{_SUPABASE_URL}/rest/v1/{table}",
                headers=_headers(),
                json=payload,
            )
    except Exception:
        pass  # logging must never crash the app


# ─────────────────────────────────────────────────────────────
# Public logging helpers
# ─────────────────────────────────────────────────────────────

async def log_ai_request(
    *,
    user_id: Optional[str],
    session_id: Optional[str],
    model: str,
    provider: str = "openai",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: Optional[int] = None,
    status: str = "success",
    error_message: Optional[str] = None,
) -> None:
    total = prompt_tokens + completion_tokens
    # Rough cost estimate (GPT-4.1-mini pricing as baseline)
    cost = (prompt_tokens * 0.0000004) + (completion_tokens * 0.0000016)
    await _insert("ai_request_logs", {
        "user_id": user_id,
        "session_id": session_id,
        "model": model,
        "provider": provider,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total,
        "cost_usd": round(cost, 6),
        "latency_ms": latency_ms,
        "status": status,
        "error_message": error_message,
    })


async def log_tool_call(
    *,
    user_id: Optional[str],
    tool_name: str,
    tool_input: Optional[dict] = None,
    tool_output: Optional[dict] = None,
    latency_ms: Optional[int] = None,
    status: str = "success",
    error_message: Optional[str] = None,
) -> None:
    await _insert("tool_call_logs", {
        "user_id": user_id,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_output": tool_output,
        "latency_ms": latency_ms,
        "status": status,
        "error_message": error_message,
    })


async def log_agent_activity(
    *,
    user_id: Optional[str],
    agent_type: str,
    task_summary: Optional[str] = None,
    steps: Optional[list] = None,
    status: str = "completed",
    duration_ms: Optional[int] = None,
) -> None:
    await _insert("agent_activity_logs", {
        "user_id": user_id,
        "agent_type": agent_type,
        "task_summary": task_summary,
        "steps": steps or [],
        "status": status,
        "duration_ms": duration_ms,
    })


async def log_rag_document(
    *,
    user_id: str,
    filename: str,
    file_size: Optional[int] = None,
    chunk_count: int = 0,
    namespace: Optional[str] = None,
    status: str = "indexed",
) -> str:
    doc_id = str(uuid.uuid4())
    await _insert("rag_documents", {
        "id": doc_id,
        "user_id": user_id,
        "filename": filename,
        "file_size": file_size,
        "chunk_count": chunk_count,
        "namespace": namespace,
        "status": status,
    })
    return doc_id


async def log_error(
    *,
    user_id: Optional[str],
    source: str,
    error_type: str,
    message: str,
    stack_trace: Optional[str] = None,
    context: Optional[dict] = None,
) -> None:
    await _insert("error_logs", {
        "user_id": user_id,
        "source": source,
        "error_type": error_type,
        "message": message,
        "stack_trace": stack_trace,
        "context": context,
    })


async def upsert_user_plan(
    *,
    user_id: str,
    plan: str = "free",
    messages_used_delta: int = 0,
    tokens_used_delta: int = 0,
    uploads_used_delta: int = 0,
) -> None:
    """Upsert user plan row and increment usage counters."""
    LIMITS = {
        "free":       {"messages_limit": 50,    "uploads_limit": 5,   "tokens_limit": 100_000},
        "pro":        {"messages_limit": 500,   "uploads_limit": 50,  "tokens_limit": 1_000_000},
        "business":   {"messages_limit": 2000,  "uploads_limit": 200, "tokens_limit": 5_000_000},
        "enterprise": {"messages_limit": 99999, "uploads_limit": 9999,"tokens_limit": 99_999_999},
    }
    limits = LIMITS.get(plan, LIMITS["free"])
    # Use Supabase RPC upsert pattern via REST
    if not _SUPABASE_URL or not _SERVICE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Try to get existing plan
            r = await client.get(
                f"{_SUPABASE_URL}/rest/v1/user_plans?user_id=eq.{user_id}&select=*",
                headers=_headers(),
            )
            existing = r.json()
            if existing:
                row = existing[0]
                await client.patch(
                    f"{_SUPABASE_URL}/rest/v1/user_plans?user_id=eq.{user_id}",
                    headers=_headers(),
                    json={
                        "messages_used": row["messages_used"] + messages_used_delta,
                        "tokens_used": row["tokens_used"] + tokens_used_delta,
                        "uploads_used": row["uploads_used"] + uploads_used_delta,
                        "updated_at": "now()",
                    },
                )
            else:
                await client.post(
                    f"{_SUPABASE_URL}/rest/v1/user_plans",
                    headers=_headers(),
                    json={
                        "user_id": user_id,
                        "plan": plan,
                        "messages_used": messages_used_delta,
                        "tokens_used": tokens_used_delta,
                        "uploads_used": uploads_used_delta,
                        **limits,
                    },
                )
    except Exception:
        pass
