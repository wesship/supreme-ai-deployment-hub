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
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.middleware.auth import get_current_user_id
from backend.marketplace.installations import (
    InstallationRequest,
    LifecycleRequest,
    installation_row,
    lifecycle_target,
)

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
        "author": {"id": "d3vonn", "name": "D3VONN.IO", "verified": True, "agentCount": agent_count},
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
        raise HTTPException(status_code=503, detail="Marketplace registry is not configured")
    params = {
        "select": "id,agent_name,display_name,role,capabilities,status,created_at,updated_at",
        "status": "eq.active",
        "order": "display_name.asc",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(f"{SUPABASE_URL}/rest/v1/agent_registry", headers=_headers(), params=params)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace registry is temporarily unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Marketplace registry query failed")
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


async def _fetch_installation(*, installation_id: str, user_id: str) -> dict[str, Any]:
    params = {
        "select": "id,user_id,template_id,name,status,config,mcp_config",
        "id": f"eq.{installation_id}",
        "user_id": f"eq.{user_id}",
        "limit": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(f"{SUPABASE_URL}/rest/v1/deployed_agents", headers=_headers(), params=params)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace installation service is temporarily unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Marketplace installation lookup failed")
    payload = response.json()
    if not isinstance(payload, list) or not payload:
        raise HTTPException(status_code=404, detail="Marketplace installation was not found")
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


async def _set_installation_status(*, installation_id: str, user_id: str, target: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/deployed_agents",
                headers=_headers(representation=True),
                params={"id": f"eq.{installation_id}", "user_id": f"eq.{user_id}"},
                json={"status": target},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Marketplace lifecycle service is temporarily unavailable") from exc
    if response.status_code not in {200, 204}:
        raise HTTPException(status_code=502, detail="Marketplace lifecycle update failed")
    payload = response.json() if response.content else []
    if not isinstance(payload, list) or not payload:
        raise HTTPException(status_code=404, detail="Marketplace installation was not found")
    return payload[0]


async def _append_installation_event(
    *,
    installation: dict[str, Any],
    actor_id: str,
    event_type: str,
    before_state: dict[str, Any] | None,
) -> None:
    event = {
        "installation_id": installation.get("id"),
        "actor_id": actor_id,
        "event_type": event_type,
        "before_state": before_state,
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


async def _transition_with_audit(
    *, installation: dict[str, Any], actor_id: str, target: str, event_type: str
) -> dict[str, Any]:
    before = {"status": installation.get("status")}
    updated = await _set_installation_status(
        installation_id=str(installation["id"]), user_id=actor_id, target=target
    )
    try:
        await _append_installation_event(
            installation=updated,
            actor_id=actor_id,
            event_type=event_type,
            before_state=before,
        )
    except HTTPException:
        # Compensate to the previous state if the immutable audit append fails.
        await _set_installation_status(
            installation_id=str(installation["id"]),
            user_id=actor_id,
            target=str(installation.get("status") or "stopped"),
        )
        raise
    return updated


def _discovery_score(agent: dict[str, Any], query: str) -> tuple[int, list[str]]:
    terms = [term for term in re.findall(r"[a-z0-9]+", query.lower()) if len(term) > 1]
    if not terms:
        return 0, []

    fields = {
        "name": str(agent.get("name") or "").lower(),
        "category": str(agent.get("category") or "").lower(),
        "description": str(agent.get("description") or "").lower(),
        "capabilities": " ".join(str(v).lower() for v in agent.get("capabilities") or []),
        "tags": " ".join(str(v).lower() for v in agent.get("tags") or []),
    }
    weights = {"name": 5, "category": 4, "capabilities": 4, "tags": 3, "description": 2}
    score = 0
    matched: list[str] = []
    for term in terms:
        term_score = 0
        for field, text in fields.items():
            if term in text:
                term_score += weights[field]
        if term_score:
            matched.append(term)
            score += term_score

    phrase = query.strip().lower()
    if phrase and phrase in fields["description"]:
        score += 6
    if phrase and phrase in fields["name"]:
        score += 10
    return score, matched


def _discover_agents(agents: list[dict[str, Any]], query: str, limit: int = 8) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for agent in agents:
        score, matched = _discovery_score(agent, query)
        if score <= 0:
            continue
        ranked.append({
            "agent": agent,
            "score": score,
            "matchedTerms": matched,
            "reason": (
                f"Matched {', '.join(matched[:4])} across the agent's registered "
                "capabilities, category, tags, name, or description."
            ),
        })
    ranked.sort(key=lambda item: (-int(item["score"]), str(item["agent"].get("name") or "")))
    return ranked[:limit]


@router.get("/agents")
async def list_marketplace_agents() -> dict[str, Any]:
    now = time.time()
    if _cache["data"] is not None and now - float(_cache["ts"]) < _CACHE_TTL:
        return _cache["data"]
    rows = await _fetch_registry_rows()
    agents = [_map_registry_row(row, len(rows)) for row in rows]
    result = {"source": "agent_registry", "live": True, "count": len(agents), "agents": agents}
    _cache["data"] = result
    _cache["ts"] = now
    return result


@router.get("/discover")
async def discover_marketplace_agents(
    q: str = Query(..., min_length=2, max_length=240),
    limit: int = Query(8, ge=1, le=20),
) -> dict[str, Any]:
    catalog = await list_marketplace_agents()
    agents = catalog.get("agents") if isinstance(catalog, dict) else []
    safe_agents = agents if isinstance(agents, list) else []
    recommendations = _discover_agents(safe_agents, q, limit)
    return {
        "query": q,
        "source": catalog.get("source", "agent_registry") if isinstance(catalog, dict) else "agent_registry",
        "live": bool(catalog.get("live")) if isinstance(catalog, dict) else False,
        "count": len(recommendations),
        "recommendations": recommendations,
    }


@router.post("/installations", status_code=status.HTTP_201_CREATED)
async def create_marketplace_installation(
    request: InstallationRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    registry_row = await _fetch_registry_row(request.agent_id)
    row = installation_row(user_id=user_id, request=request, registry_row=registry_row)
    installation = await _persist_installation(row)
    try:
        await _append_installation_event(
            installation=installation,
            actor_id=user_id,
            event_type="installed",
            before_state=None,
        )
    except HTTPException:
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


@router.post("/installations/{installation_id}/lifecycle")
async def change_marketplace_installation_lifecycle(
    installation_id: str,
    request: LifecycleRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    installation = await _fetch_installation(installation_id=installation_id, user_id=user_id)
    target = lifecycle_target(current_status=str(installation.get("status") or ""), action=request.action)
    updated = await _transition_with_audit(
        installation=installation,
        actor_id=user_id,
        target=target,
        event_type=f"lifecycle_{request.action}",
    )
    return {"id": updated.get("id"), "status": updated.get("status"), "authority": "server"}


@router.delete("/installations/{installation_id}")
async def uninstall_marketplace_installation(
    installation_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    installation = await _fetch_installation(installation_id=installation_id, user_id=user_id)
    if str(installation.get("status") or "").lower() == "revoked":
        raise HTTPException(status_code=409, detail="Marketplace installation is already revoked")
    updated = await _transition_with_audit(
        installation=installation,
        actor_id=user_id,
        target="revoked",
        event_type="uninstalled",
    )
    return {"id": updated.get("id"), "status": "revoked", "authority": "server"}


@router.get("/health")
async def marketplace_health() -> dict[str, str]:
    return {
        "status": "ok",
        "source": "agent_registry",
        "supabase": "configured" if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else "not_configured",
    }
