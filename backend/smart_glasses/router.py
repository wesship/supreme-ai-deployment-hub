"""SG-01 smart-glasses gateway for D3VONN.IO.

This surface intentionally exposes a very small tool allowlist. Needle (or another
on-device router) selects a tool; this gateway authenticates the device, applies
confidence-based routing, records metadata-only telemetry, and either instructs
the device to execute locally or forwards to a configured D3VONN/HERMES service.
Raw image payloads are never written to application logs.
"""
from __future__ import annotations

import hmac
import logging
import os
import time
from enum import Enum
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/smart-glasses/v1", tags=["smart-glasses"])


class SmartGlassesTool(str, Enum):
    capture_image = "capture_image"
    describe_scene = "describe_scene"
    read_text = "read_text"
    remember_this = "remember_this"
    ask_d3vonn = "ask_d3vonn"


class SmartGlassesRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    session_id: str = Field(min_length=1, max_length=128)
    tool: SmartGlassesTool
    confidence: float = Field(ge=0.0, le=1.0)
    utterance: str | None = Field(default=None, max_length=4000)
    image_data: str | None = Field(
        default=None,
        max_length=12_000_000,
        description="Optional base64/data-URL image. Never logged by this service.",
    )
    context: dict[str, Any] = Field(default_factory=dict)


class SmartGlassesResponse(BaseModel):
    status: Literal["local_execute", "completed", "escalation_required", "upstream_error"]
    route: Literal["local", "vision", "hermes"]
    tool: SmartGlassesTool
    device_id: str
    session_id: str
    latency_ms: int
    model_used: str | None = None
    agent_used: str | None = None
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


def _confidence_threshold() -> float:
    raw = os.getenv("SMART_GLASSES_CONFIDENCE_THRESHOLD", "0.72")
    try:
        return min(1.0, max(0.0, float(raw)))
    except ValueError:
        return 0.72


def _authenticate_device(provided_key: str | None) -> None:
    expected = os.getenv("SMART_GLASSES_DEVICE_KEY", "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Smart-glasses device authentication is not configured",
        )
    if not provided_key or not hmac.compare_digest(provided_key, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credentials")


def _route_for(request: SmartGlassesRequest) -> Literal["local", "vision", "hermes"]:
    # Low-confidence local decisions never execute directly. They are escalated.
    if request.confidence < _confidence_threshold():
        return "hermes"
    if request.tool is SmartGlassesTool.capture_image:
        return "local"
    if request.tool in {SmartGlassesTool.describe_scene, SmartGlassesTool.read_text}:
        return "vision"
    return "hermes"


def _upstream_for(route_name: Literal["vision", "hermes"]) -> tuple[str, str | None]:
    if route_name == "vision":
        return os.getenv("SMART_GLASSES_VISION_URL", "").strip(), os.getenv("SMART_GLASSES_VISION_TOKEN")
    return os.getenv("SMART_GLASSES_HERMES_URL", "").strip(), os.getenv("SMART_GLASSES_HERMES_TOKEN")


async def _forward(request: SmartGlassesRequest, route_name: Literal["vision", "hermes"]) -> SmartGlassesResponse:
    started = time.perf_counter()
    url, token = _upstream_for(route_name)
    if not url:
        return SmartGlassesResponse(
            status="escalation_required",
            route=route_name,
            tool=request.tool,
            device_id=request.device_id,
            session_id=request.session_id,
            latency_ms=int((time.perf_counter() - started) * 1000),
            agent_used="vision" if route_name == "vision" else "HERMES",
            error=f"{route_name} upstream is not configured",
        )

    headers = {"Content-Type": "application/json", "X-Request-ID": request.session_id}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = request.model_dump(mode="json")
    try:
        timeout = float(os.getenv("SMART_GLASSES_UPSTREAM_TIMEOUT_SECONDS", "20"))
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        upstream = response.json()
        return SmartGlassesResponse(
            status="completed",
            route=route_name,
            tool=request.tool,
            device_id=request.device_id,
            session_id=request.session_id,
            latency_ms=int((time.perf_counter() - started) * 1000),
            model_used=upstream.get("model_used") if isinstance(upstream, dict) else None,
            agent_used=(upstream.get("agent_used") if isinstance(upstream, dict) else None)
            or ("vision" if route_name == "vision" else "HERMES"),
            result=upstream if isinstance(upstream, dict) else {"value": upstream},
        )
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "smart_glasses_upstream_error device_id=%s session_id=%s tool=%s route=%s error_type=%s",
            request.device_id,
            request.session_id,
            request.tool.value,
            route_name,
            type(exc).__name__,
        )
        return SmartGlassesResponse(
            status="upstream_error",
            route=route_name,
            tool=request.tool,
            device_id=request.device_id,
            session_id=request.session_id,
            latency_ms=int((time.perf_counter() - started) * 1000),
            agent_used="vision" if route_name == "vision" else "HERMES",
            error="Upstream request failed",
        )


@router.post("/execute", response_model=SmartGlassesResponse)
async def execute_smart_glasses_tool(
    request: SmartGlassesRequest,
    x_d3vonn_device_key: str | None = Header(default=None, alias="X-D3VONN-Device-Key"),
) -> SmartGlassesResponse:
    """Execute or route one allowlisted smart-glasses tool request."""
    started = time.perf_counter()
    _authenticate_device(x_d3vonn_device_key)
    route_name = _route_for(request)

    logger.info(
        "smart_glasses_request device_id=%s session_id=%s tool=%s confidence=%.3f route=%s has_image=%s",
        request.device_id,
        request.session_id,
        request.tool.value,
        request.confidence,
        route_name,
        bool(request.image_data),
    )

    if route_name == "local":
        return SmartGlassesResponse(
            status="local_execute",
            route="local",
            tool=request.tool,
            device_id=request.device_id,
            session_id=request.session_id,
            latency_ms=int((time.perf_counter() - started) * 1000),
            agent_used="Needle",
            result={"device_action": request.tool.value},
        )

    return await _forward(request, route_name)


@router.get("/health")
async def smart_glasses_health() -> dict[str, Any]:
    """Configuration-only health view; never returns secret values."""
    return {
        "status": "ok",
        "device_auth_configured": bool(os.getenv("SMART_GLASSES_DEVICE_KEY", "").strip()),
        "vision_configured": bool(os.getenv("SMART_GLASSES_VISION_URL", "").strip()),
        "hermes_configured": bool(os.getenv("SMART_GLASSES_HERMES_URL", "").strip()),
        "confidence_threshold": _confidence_threshold(),
        "tools": [tool.value for tool in SmartGlassesTool],
    }
