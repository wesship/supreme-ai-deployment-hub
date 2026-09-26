from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access

from .client import WorldMonitorClient
from .service import ALLOWED_TOOLS, WorldMonitorIngestionService

router = APIRouter(prefix="/api/intelligence/worldmonitor", tags=["worldmonitor-intelligence"])


class IngestRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)
    persist: bool = True
    enqueue_hermes: bool = True


class AnalyzeRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=4000)
    context: str | None = Field(default=None, max_length=12000)
    framework: str | None = Field(default=None, max_length=2000)


@router.get("/health")
async def worldmonitor_health(_: OCCPrincipal = Depends(require_occ_access)):
    client = WorldMonitorClient()
    return {
        "status": "ok" if client.configured else "degraded",
        "configured": client.configured,
        "mcp_url": client.config.mcp_url,
        "allowed_tools": sorted(ALLOWED_TOOLS),
    }


@router.get("/tools")
async def worldmonitor_tools(_: OCCPrincipal = Depends(require_occ_access)):
    try:
        return await WorldMonitorClient().list_tools()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"World Monitor discovery failed: {exc}") from exc


@router.post("/ingest/{tool_name}")
async def ingest_worldmonitor_tool(
    tool_name: str,
    body: IngestRequest,
    _: OCCPrincipal = Depends(require_occ_access),
):
    if tool_name not in ALLOWED_TOOLS:
        raise HTTPException(
            status_code=400,
            detail={"error": "tool_not_allowlisted", "allowed_tools": sorted(ALLOWED_TOOLS)},
        )
    service = WorldMonitorIngestionService()
    if not service.configured:
        raise HTTPException(status_code=503, detail="WORLDMONITOR_API_KEY is not configured")
    try:
        return await service.ingest(
            tool_name,
            body.arguments,
            persist=body.persist,
            enqueue_hermes=body.enqueue_hermes,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"World Monitor returned HTTP {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"World Monitor network error: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/world-brief")
async def ingest_world_brief(
    body: IngestRequest,
    _: OCCPrincipal = Depends(require_occ_access),
):
    service = WorldMonitorIngestionService()
    if not service.configured:
        raise HTTPException(status_code=503, detail="WORLDMONITOR_API_KEY is not configured")
    try:
        return await service.ingest(
            "get_world_brief",
            body.arguments,
            persist=body.persist,
            enqueue_hermes=body.enqueue_hermes,
        )
    except (httpx.HTTPError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/analyze")
async def analyze_worldmonitor_situation(
    body: AnalyzeRequest,
    _: OCCPrincipal = Depends(require_occ_access),
):
    client = WorldMonitorClient()
    if not client.configured:
        raise HTTPException(status_code=503, detail="WORLDMONITOR_API_KEY is not configured")
    try:
        return await client.analyze_situation(
            body.query,
            context=body.context,
            framework=body.framework,
        )
    except (httpx.HTTPError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
