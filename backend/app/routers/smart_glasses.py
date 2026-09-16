"""Authenticated SG-01 ingress for the existing Needle smart-glasses stack."""
from __future__ import annotations

import hmac
import logging
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.services.smart_glasses_gateway import RedisNonceStore, authorize_request
from backend.app.services.smart_glasses_vision import run_vision_action

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/smart-glasses/v1", tags=["smart-glasses"])


class SmartGlassesEnvelope(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    nonce: str = Field(min_length=8, max_length=256)
    correlation_id: str = Field(min_length=1, max_length=128)
    proposal: dict[str, Any]
    payload: dict[str, Any] = Field(default_factory=dict)


class _EnvDeviceRegistry:
    async def is_active(self, device_id: str) -> bool:
        allowed = {value.strip() for value in os.getenv("SMART_GLASSES_DEVICE_IDS", "").split(",") if value.strip()}
        return device_id in allowed


class _EnvKillSwitch:
    async def enabled(self) -> bool:
        return os.getenv("SMART_GLASSES_KILL_SWITCH", "false").strip().lower() in {"1", "true", "yes", "on"}


def _require_device_key(provided: str | None) -> None:
    expected = os.getenv("SMART_GLASSES_DEVICE_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Smart-glasses device authentication is not configured")
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credentials")


async def _nonce_store() -> RedisNonceStore:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Smart-glasses replay protection is not configured")
    try:
        import redis.asyncio as redis
    except ImportError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Smart-glasses replay protection is unavailable") from exc
    return RedisNonceStore(redis.from_url(redis_url, decode_responses=True))


def _upstream_for(action: str | None) -> tuple[str, str, str | None]:
    if action in {"describe_scene", "read_text"}:
        return os.getenv("SMART_GLASSES_VISION_URL", "").strip(), "vision", os.getenv("SMART_GLASSES_VISION_TOKEN")
    return os.getenv("SMART_GLASSES_HERMES_URL", "").strip(), "HERMES", os.getenv("SMART_GLASSES_HERMES_TOKEN")


async def _forward_remote(envelope: SmartGlassesEnvelope, action: str | None, started: float) -> dict[str, Any]:
    url, agent, token = _upstream_for(action)
    if not url and action in {"describe_scene", "read_text"}:
        result = await run_vision_action(action=action, payload=envelope.payload, correlation_id=envelope.correlation_id)
        return {
            "status": "completed",
            "route": "d3vonn_gateway",
            "device_id": envelope.device_id,
            "correlation_id": envelope.correlation_id,
            "action": action,
            "agent_used": result.get("agent_used", "D3VONN Vision"),
            "model_used": result.get("model_used"),
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "result": result,
        }
    if not url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Smart-glasses {agent} upstream is not configured")

    headers = {"Content-Type": "application/json", "X-Request-ID": envelope.correlation_id}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = {"device_id": envelope.device_id, "correlation_id": envelope.correlation_id, "action": action, "payload": envelope.payload}
    try:
        timeout = float(os.getenv("SMART_GLASSES_UPSTREAM_TIMEOUT_SECONDS", "20"))
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("smart_glasses_upstream_error device_id=%s correlation_id=%s action=%s agent=%s error_type=%s", envelope.device_id, envelope.correlation_id, action, agent, type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Smart-glasses upstream failed") from exc
    return {
        "status": "completed",
        "route": "d3vonn_gateway",
        "device_id": envelope.device_id,
        "correlation_id": envelope.correlation_id,
        "action": action,
        "agent_used": result.get("agent_used", agent) if isinstance(result, dict) else agent,
        "model_used": result.get("model_used") if isinstance(result, dict) else None,
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "result": result,
    }


@router.post("/execute")
async def execute_smart_glasses_proposal(envelope: SmartGlassesEnvelope, x_d3vonn_device_key: str | None = Header(default=None, alias="X-D3VONN-Device-Key")) -> dict[str, Any]:
    started = time.perf_counter()
    _require_device_key(x_d3vonn_device_key)
    nonce_store = await _nonce_store()
    decision = await authorize_request(device_id=envelope.device_id, nonce=envelope.nonce, correlation_id=envelope.correlation_id, proposal=envelope.proposal, nonce_store=nonce_store, device_registry=_EnvDeviceRegistry(), kill_switch=_EnvKillSwitch())
    logger.info("smart_glasses_decision device_id=%s correlation_id=%s action=%s decision=%s reason=%s", envelope.device_id, envelope.correlation_id, decision.action, decision.route, decision.reason)
    if decision.route == "deny":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=decision.reason)
    if decision.route == "guardian_review":
        return {"status": "guardian_review", "route": "guardian_review", "device_id": envelope.device_id, "correlation_id": envelope.correlation_id, "action": decision.action, "reason": decision.reason, "latency_ms": int((time.perf_counter() - started) * 1000)}
    if envelope.proposal.get("route") == "local":
        return {"status": "local_execute", "route": "local", "device_id": envelope.device_id, "correlation_id": envelope.correlation_id, "action": decision.action, "agent_used": "Needle", "latency_ms": int((time.perf_counter() - started) * 1000)}
    return await _forward_remote(envelope, decision.action, started)


@router.get("/health")
async def smart_glasses_health() -> dict[str, Any]:
    external_vision = bool(os.getenv("SMART_GLASSES_VISION_URL", "").strip())
    internal_vision = bool(os.getenv("OPENAI_API_KEY", "").strip())
    return {
        "status": "ok",
        "device_auth_configured": bool(os.getenv("SMART_GLASSES_DEVICE_KEY", "").strip()),
        "device_allowlist_configured": bool(os.getenv("SMART_GLASSES_DEVICE_IDS", "").strip()),
        "replay_protection_configured": bool(os.getenv("REDIS_URL", "").strip()),
        "vision_configured": external_vision or internal_vision,
        "vision_mode": "external" if external_vision else ("internal" if internal_vision else "unavailable"),
        "hermes_configured": bool(os.getenv("SMART_GLASSES_HERMES_URL", "").strip()),
        "kill_switch_enabled": await _EnvKillSwitch().enabled(),
    }
