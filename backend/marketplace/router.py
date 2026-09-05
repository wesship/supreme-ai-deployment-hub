"""D3VONN.IO Marketplace routes backed by the canonical agent_registry.

Public discovery is read-only. Consequential installation mutations are handled
server-side with Supabase auth validation, service-role persistence, and an
append-only audit ledger. The browser never receives service-role credentials.
"""
from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.middleware.auth import get_current_user_id
from backend.marketplace.installations import InstallationRequest, installation_row

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_TIMEOUT = 8.0
_CACHE_TTL = 60.0
_cache: dict[str, Any] = {"data": None, "ts": 0.0}

_ROLE_CATEGORY = {
    "safety": "security",
    "orchestrator": "automation",
    "analyst": "analytics",
    "memory": "integration",
    "executor": "automation",
}


def _headers(*, representation: bool = False) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if representation:
        headers["Prefer"] = "return=representation"
    return headers


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def _normalized_capabilities(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        text = _slug(str(item))
        if text and text not in normalized:
            normalized.append(text)
    return normalized


def _status(value: str) -> str:
    lowered = (value or "").strip().lower()
    if lowered == "active":
        return "published"
    if lowered in {"deprecated", "retired", "disabled"}:
        return "deprecated"
    return "pending-review"


def _map_registry_row(row: dict[str, Any], agent_count: int) -> dict[str, Any]:
    name = str(row.get("display_name") or row.get("agent_name") or "D3VONN Agent")
    agent_name = str(row.get("agent_name") or name)
    role = str(row.get("role") or "custom").strip().lower()
    capabilities = _normalized_capabilities(row.get("capabilities"))
    updated_at = str(row.get("updated_at") or row.get("created_at") or "")
    created_at = str(row.get("created_at") or updated_at)
    capability_text = ", ".join(cap.replace("-", " ") for cap in capabilities[:4])
    description = f"Live D3VONN.IO {role} agent registered in the canonical agent registry."
    if capability_text:
        description += f" Capabilities include {capability_text}."

    return {
        "id": str(row.get("id") or agent_name),
        "name": name,
        "slug": _slug(agent_name),
        "description": description,
        "longDescription": (
            f"{name} is sourced from the live D3VONN.IO agent registry. "
            "Marketplace install, download, pricing, and review telemetry are not yet linked, "
            "so those values are intentionally not inferred."
        ),
        "category": _ROLE_CATEGORY.get(role, "custom"),
        "capabilities": capabilities,
        "pricing": {"model": "contact-sales"},
        "author": {
            "id": "d3vonn",
            "name": "D3VONN.IO",
            "verified": True,
            "agentCount": agent_count,
        },
        "status": _status(str(row.get("status") or "")),
        "version": "current",
        "tags": [role, *capabilities],
        "stats": {
            "downloads": 0,
            "activeInstalls": 0,
            "avgRating": 0,
            "reviewCount": 0,
            "lastUpdated": updated_at,
        },
        "createdAt": created_at,
        "updatedAt": updated_at,
        "featured": False,
    }


async def _fetch_registry_rows() -> list[dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Marketplace registry is not configured")

    params = {
        "select": "id,agent_name,display_name,role,capabilities,status,created_at,updated_at",
        "status": "eq.active",
        "order": "display_name.asc",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(f"{SUPABASE_URL}/rest/v1/agent_registry", headers=_headers(), params=params)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Marketplace registry is temporarily unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Marketplace registry query failed")
    payload = response.json()
    return payload if isinstance(payload, list) else []


async def _fetch_registry_row(agent_id: str) -> dict[str, Any]:
    params = {
        "select": "id,agent_name,display_name,role,capabilities,status",
        "id": f"eq.{agent_id}",
        "limit": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(f"{SUPABASE_URL}/rest/v1/agent_registry", headers=_headers(), params=params)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace registry is temporarily unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Marketplace registry query failed")
    payload = response.json()
    if not isinstance(payload, list) or not payload:
        raise HTTPException(status_code=404, detail="Marketplace agent is not available")
    return payload[0]


async def _persist_installation(row: dict[str, Any]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/deployed_agents",
                headers=_headers(representation=True),
                json=row,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace installation service is temporarily unavailable") from exc
    if response.status_code not in {200, 201}:
        raise HTTPException(status_code=502, detail="Marketplace installation could not be persisted")
    payload = response.json()
    if not isinstance(payload, list) or not payload:
        raise HTTPException(status_code=502, detail="Marketplace installation returned no record")
    return payload[0]


async def _append_installation_event(*, installation: dict[str, Any], actor_id: str) -> None:
    event = {
        "installation_id": installation.get("id"),
        "actor_id": actor_id,
        "event_type": "installed",
        "before_state": None,
        "after_state": {
            "template_id": installation.get("template_id"),
            "name": installation.get("name"),
            "status": installation.get("status"),
        },
        "metadata": {"authority": "fastapi", "source": "agent_registry"},
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/marketplace_installation_events",
                headers=_headers(),
                json=event,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace audit service is temporarily unavailable") from exc
    if response.status_code not in {200, 201, 204}:
        raise HTTPException(status_code=502, detail="Marketplace installation audit failed")


@router.get("/agents")
async def list_marketplace_agents() -> dict[str, Any]:
    """Return the public marketplace catalog sourced from agent_registry."""
    now = time.time()
    if _cache["data"] is not None and now - float(_cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    rows = await _fetch_registry_rows()
    agents = [_map_registry_row(row, len(rows)) for row in rows]
    result = {"source": "agent_registry", "live": True, "count": len(agents), "agents": agents}
    _cache["data"] = result
    _cache["ts"] = now
    return result


@router.post("/installations", status_code=status.HTTP_201_CREATED)
async def create_marketplace_installation(
    request: InstallationRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Create a governed installation using server authority only."""
    registry_row = await _fetch_registry_row(request.agent_id)
    row = installation_row(user_id=user_id, request=request, registry_row=registry_row)
    installation = await _persist_installation(row)
    try:
        await _append_installation_event(installation=installation, actor_id=user_id)
    except HTTPException:
        # An unaudited consequential mutation is not acceptable. Compensate by
        # removing the newly-created row before surfacing the audit failure.
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                await client.delete(
                    f"{SUPABASE_URL}/rest/v1/deployed_agents",
                    headers=_headers(),
                    params={"id": f"eq.{installation.get('id')}", "user_id": f"eq.{user_id}"},
                )
        finally:
            raise

    return {
        "id": installation.get("id"),
        "agentId": installation.get("template_id"),
        "name": installation.get("name"),
        "status": installation.get("status"),
        "authority": "server",
    }


@router.get("/health")
async def marketplace_health() -> dict[str, str]:
    return {
        "status": "ok",
        "source": "agent_registry",
        "supabase": "configured" if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else "not_configured",
    }
