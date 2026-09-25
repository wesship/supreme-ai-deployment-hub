"""HNFPORTAL.one gateway into the D3VONN.IO Hermes control plane.

REST, MCP JSON-RPC, and Telegram ingestion converge on one allowlisted workflow
submission service. Browser clients should call the HNFPORTAL backend; this
router is intended for authenticated server-to-server requests.
"""
from __future__ import annotations

import hmac
import json
import os
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from backend.hnf.registry import PERSONAS, WORKFLOWS, list_capabilities
from backend.hnf.service import submit_hnf_workflow

router = APIRouter(prefix="/api/hnf/v1", tags=["hnf-hermes"])


class WorkflowRequest(BaseModel):
    request_id: str = Field(min_length=8, max_length=128)
    actor_id: str = Field(min_length=1, max_length=200)
    actor_type: Literal["user", "agent", "service"] = "service"
    context: dict[str, Any] = Field(default_factory=dict)
    persona_id: str | None = Field(default=None, max_length=100)
    budget_max_usd: float | None = Field(default=None, ge=0, le=1000)
    priority: int | None = Field(default=None, ge=1, le=10)


class MCPRequest(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: str | int | None = None
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


def _configured_service_key() -> str:
    return os.getenv("HNF_HERMES_API_KEY", "").strip()


def _require_service_key(x_hnf_service_key: str | None) -> None:
    configured = _configured_service_key()
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="HNF Hermes bridge is not configured")
    if not x_hnf_service_key or not hmac.compare_digest(configured, x_hnf_service_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid HNF service credential")


def _allowed_telegram_chat_ids() -> set[str]:
    return {value.strip() for value in os.getenv("HNF_TELEGRAM_ALLOWED_CHAT_IDS", "").split(",") if value.strip()}


def _require_telegram_secret(value: str | None) -> None:
    configured = os.getenv("HNF_TELEGRAM_WEBHOOK_SECRET", "").strip()
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Telegram bridge is not configured")
    if not value or not hmac.compare_digest(configured, value):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram webhook credential")


@router.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok" if _configured_service_key() else "degraded",
        "tenant": "hnfportal",
        "transports": {
            "rest": bool(_configured_service_key()),
            "mcp": bool(_configured_service_key()),
            "telegram": bool(os.getenv("HNF_TELEGRAM_WEBHOOK_SECRET", "").strip() and _allowed_telegram_chat_ids()),
        },
        "workflow_count": len(WORKFLOWS),
        "persona_count": len(PERSONAS),
    }


@router.get("/capabilities")
async def capabilities(x_hnf_service_key: str | None = Header(default=None, alias="X-HNF-Service-Key")) -> dict[str, Any]:
    _require_service_key(x_hnf_service_key)
    return {"tenant": "hnfportal", **list_capabilities()}


@router.post("/workflows/{workflow_name}", status_code=status.HTTP_202_ACCEPTED)
async def run_workflow(
    workflow_name: str,
    body: WorkflowRequest,
    x_hnf_service_key: str | None = Header(default=None, alias="X-HNF-Service-Key"),
) -> dict[str, Any]:
    _require_service_key(x_hnf_service_key)
    if body.persona_id and body.persona_id not in PERSONAS:
        raise HTTPException(status_code=422, detail=f"Unknown HNF persona: {body.persona_id}")
    try:
        task, duplicate = await submit_hnf_workflow(
            workflow_name=workflow_name,
            request_id=body.request_id,
            actor_id=body.actor_id,
            actor_type=body.actor_type,
            context=body.context,
            persona_id=body.persona_id,
            budget_max_usd=body.budget_max_usd,
            priority=body.priority,
            transport="api",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"accepted": True, "duplicate": duplicate, "task": task}


@router.post("/mcp")
async def mcp(
    body: MCPRequest,
    x_hnf_service_key: str | None = Header(default=None, alias="X-HNF-Service-Key"),
) -> dict[str, Any]:
    _require_service_key(x_hnf_service_key)

    if body.method == "tools/list":
        tools = [
            {
                "name": workflow.name,
                "description": workflow.description,
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "request_id": {"type": "string"},
                        "actor_id": {"type": "string"},
                        "actor_type": {"type": "string", "enum": ["user", "agent", "service"]},
                        "context": {"type": "object"},
                        "persona_id": {"type": "string"},
                        "budget_max_usd": {"type": "number", "minimum": 0},
                    },
                    "required": ["request_id", "actor_id"],
                    "additionalProperties": False,
                },
            }
            for workflow in WORKFLOWS.values()
        ]
        return {"jsonrpc": "2.0", "id": body.id, "result": {"tools": tools}}

    if body.method != "tools/call":
        return {
            "jsonrpc": "2.0",
            "id": body.id,
            "error": {"code": -32601, "message": "Method not found"},
        }

    name = str(body.params.get("name") or "")
    arguments = body.params.get("arguments") or {}
    if name not in WORKFLOWS or not isinstance(arguments, dict):
        return {
            "jsonrpc": "2.0",
            "id": body.id,
            "error": {"code": -32602, "message": "Invalid HNF workflow or arguments"},
        }

    request_id = str(arguments.get("request_id") or f"mcp-{uuid.uuid4()}")
    actor_id = str(arguments.get("actor_id") or "hnf-mcp")
    persona_id = arguments.get("persona_id")
    if persona_id and persona_id not in PERSONAS:
        return {
            "jsonrpc": "2.0",
            "id": body.id,
            "error": {"code": -32602, "message": f"Unknown HNF persona: {persona_id}"},
        }
    task, duplicate = await submit_hnf_workflow(
        workflow_name=name,
        request_id=request_id,
        actor_id=actor_id,
        actor_type=str(arguments.get("actor_type") or "service"),
        context=arguments.get("context") if isinstance(arguments.get("context"), dict) else {},
        persona_id=persona_id,
        budget_max_usd=arguments.get("budget_max_usd"),
        transport="mcp",
    )
    return {
        "jsonrpc": "2.0",
        "id": body.id,
        "result": {
            "content": [{"type": "text", "text": json.dumps({"accepted": True, "duplicate": duplicate, "task": task})}],
            "structuredContent": {"accepted": True, "duplicate": duplicate, "task": task},
        },
    }


@router.post("/telegram/webhook", status_code=status.HTTP_202_ACCEPTED)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
) -> dict[str, Any]:
    _require_telegram_secret(x_telegram_bot_api_secret_token)
    update = await request.json()
    message = update.get("message") or update.get("edited_message") or {}
    chat_id = str((message.get("chat") or {}).get("id") or "")
    if chat_id not in _allowed_telegram_chat_ids():
        raise HTTPException(status_code=403, detail="Telegram chat is not allowlisted")

    text = str(message.get("text") or "").strip()
    # Syntax: /hnf run hnf.radio.dj.generate optional free-form context
    parts = text.split(maxsplit=3)
    if len(parts) < 3 or parts[0].lower() not in {"/hnf", "/hnf@d3vonn"} or parts[1].lower() != "run":
        return {"accepted": False, "help": "/hnf run <workflow> [context]"}

    workflow_name = parts[2].strip().lower()
    context_text = parts[3].strip() if len(parts) == 4 else ""
    if workflow_name not in WORKFLOWS:
        return {"accepted": False, "error": "unknown_workflow"}

    update_id = str(update.get("update_id") or uuid.uuid4())
    task, duplicate = await submit_hnf_workflow(
        workflow_name=workflow_name,
        request_id=f"telegram-{update_id}",
        actor_id=f"telegram:{chat_id}",
        actor_type="user",
        context={"text": context_text, "telegram_update_id": update_id},
        transport="telegram",
    )
    return {"accepted": True, "duplicate": duplicate, "task_id": task.get("id"), "workflow": workflow_name}
