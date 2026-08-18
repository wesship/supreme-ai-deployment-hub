"""Secure assurance control-plane API for D3VONN.IO."""
from __future__ import annotations

import json
import logging
import re
import uuid
from hashlib import sha256
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Literal
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from backend.app.assurance.security import (
    UnsafeRemoteTarget,
    build_webhook_signature,
    verify_public_https_target,
)
from backend.app.assurance.store import AssuranceStore
from backend.app.config import get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assurance", tags=["assurance"])
store = AssuranceStore()

PUBLIC_ROUTE_PATHS = (
    "/",
    "/solutions",
    "/pricing",
    "/security",
    "/security/disclosure",
    "/resources",
    "/ai-agents",
    "/business-automation",
    "/marketplace",
    "/mcp",
    "/film",
    "/documentation",
    "/about",
    "/contact",
    "/enterprise-readiness",
    "/terms",
    "/privacy",
)


class HtmlMetadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self.meta: dict[tuple[str, str], str] = {}
        self.canonical = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            for key in ("name", "property"):
                if values.get(key):
                    self.meta[(key, values[key].lower())] = values.get("content", "")
        if tag.lower() == "link" and "canonical" in values.get("rel", "").lower():
            self.canonical = values.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data.strip()


class RumMetric(BaseModel):
    name: Literal["LCP", "INP", "CLS"]
    value: float = Field(ge=0, le=120_000)
    route: str = Field(min_length=1, max_length=200)
    navigation_type: str = Field(default="navigate", max_length=40)
    deployment: str = Field(default="production", max_length=40)

    @field_validator("route")
    @classmethod
    def validate_known_route(cls, value: str) -> str:
        if value not in PUBLIC_ROUTE_PATHS:
            raise ValueError("Metric route is not registered for public assurance")
        return value


class SyntheticMetric(RumMetric):
    source: Literal["synthetic"] = "synthetic"


class GatewayRegistration(BaseModel):
    label: str = Field(min_length=3, max_length=100)
    gateway_url: str = Field(min_length=12, max_length=500)
    expires_at: datetime | None = None


class GatewayRunRequest(BaseModel):
    gateway_id: uuid.UUID
    goal: str = Field(min_length=3, max_length=4_000)
    max_steps: int = Field(default=10, ge=1, le=25)


class RemediationPatch(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None
    owner: str | None = Field(default=None, min_length=2, max_length=120)
    target_date: datetime | None = None
    acceptance_criteria: list[str] | None = None


class StatusSubscriptionRequest(BaseModel):
    email: str | None = Field(default=None, max_length=320)
    webhook_url: str | None = Field(default=None, max_length=500)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        candidate = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", candidate):
            raise ValueError("A valid email address is required")
        return candidate


async def require_assurance_admin(user_id: str = Depends(get_current_user_id)) -> str:
    settings = get_settings()
    if user_id not in settings.assurance_admin_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assurance administrator access required")
    return user_id


def canonical_origin() -> str:
    return get_settings().canonical_site_origin.rstrip("/")


def _metadata_result(route: str, response: httpx.Response) -> dict[str, Any]:
    parser = HtmlMetadata()
    parser.feed(response.text)
    expected_canonical = f"{canonical_origin()}{route}" if route != "/" else f"{canonical_origin()}/"
    checks = {
        "http_ok": response.status_code == 200,
        "title": bool(parser.title.strip()),
        "description": bool(parser.meta.get(("name", "description"), "").strip()),
        "canonical": parser.canonical == expected_canonical,
        "open_graph_title": bool(parser.meta.get(("property", "og:title"), "").strip()),
        "open_graph_description": bool(parser.meta.get(("property", "og:description"), "").strip()),
        "open_graph_url": parser.meta.get(("property", "og:url"), "") == expected_canonical,
    }
    return {
        "route": route,
        "url": expected_canonical,
        "status_code": response.status_code,
        "passed": all(checks.values()),
        "checks": checks,
        "title": parser.title.strip(),
        "canonical": parser.canonical,
    }


@router.get("/public/canonical-configuration")
async def get_canonical_configuration() -> dict[str, Any]:
    return {
        "canonical_origin": canonical_origin(),
        "routes": list(PUBLIC_ROUTE_PATHS),
        "redirect_policy": "Apex host redirects permanently to the canonical www host.",
    }


@router.post("/admin/metadata/validate")
async def validate_route_metadata(_: str = Depends(require_assurance_admin)) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
        for route in PUBLIC_ROUTE_PATHS:
            url = f"{canonical_origin()}{route}"
            try:
                response = await client.get(url, headers={"User-Agent": "D3VONN-Assurance-Metadata-Validator/1.0"})
                results.append(_metadata_result(route, response))
            except httpx.HTTPError as exc:
                results.append({"route": route, "url": url, "passed": False, "error": str(exc)})
    if store.configured:
        await store.insert("assurance_route_audits", {
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "result": {"routes": results},
            "passed": all(item.get("passed") for item in results),
        })
    return {"canonical_origin": canonical_origin(), "routes": results, "passed": all(item.get("passed") for item in results)}


@router.post("/public/rum", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(rate_limit(120, 60))])
async def record_rum_metric(metric: RumMetric, request: Request) -> dict[str, bool]:
    if store.configured:
        await store.insert("assurance_performance_samples", {
            "route": metric.route,
            "metric_name": metric.name,
            "metric_value": metric.value,
            "source": "rum",
            "navigation_type": metric.navigation_type,
            "deployment": metric.deployment,
            "user_agent_family": (request.headers.get("user-agent") or "unknown")[:180],
        })
    return {"accepted": True}


@router.post("/admin/performance/synthetic", status_code=status.HTTP_202_ACCEPTED)
async def record_synthetic_metric(metric: SyntheticMetric, _: str = Depends(require_assurance_admin)) -> dict[str, bool]:
    if store.configured:
        await store.insert("assurance_performance_samples", {
            "route": metric.route,
            "metric_name": metric.name,
            "metric_value": metric.value,
            "source": "synthetic",
            "navigation_type": metric.navigation_type,
            "deployment": metric.deployment,
        })
    return {"accepted": True}


@router.post("/public/csp-reports", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(rate_limit(60, 60))])
async def record_csp_report(request: Request) -> dict[str, bool]:
    try:
        body = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid CSP report JSON")
    reports = body if isinstance(body, list) else [body.get("csp-report", body)] if isinstance(body, dict) else []
    normalized = []
    for report in reports[:20]:
        if not isinstance(report, dict):
            continue
        normalized.append({
            "document_uri": str(report.get("document-uri") or report.get("url") or "")[:500],
            "violated_directive": str(report.get("violated-directive") or report.get("effective-directive") or "")[:200],
            "blocked_uri": str(report.get("blocked-uri") or "")[:500],
            "source_file": str(report.get("source-file") or "")[:500],
            "line_number": report.get("line-number"),
        })
    if store.configured:
        for report in normalized:
            await store.insert("assurance_csp_reports", report)
    return {"accepted": True}


@router.get("/mcp/gateways")
async def list_registered_gateways(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    rows = await store.list(
        "assurance_mcp_gateways",
        params={"select": "id,label,origin,status,expires_at,created_at", "status": "eq.approved", "order": "label.asc"},
    )
    return {"gateways": rows, "actor": user_id}


@router.post("/admin/mcp/gateways", status_code=status.HTTP_201_CREATED)
async def register_gateway(
    payload: GatewayRegistration,
    admin_id: str = Depends(require_assurance_admin),
) -> dict[str, Any]:
    try:
        target = await verify_public_https_target(payload.gateway_url)
    except UnsafeRemoteTarget as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    row = await store.insert("assurance_mcp_gateways", {
        "label": payload.label.strip(),
        "origin": target.url,
        "hostname": target.hostname,
        "approved_addresses": list(target.addresses),
        "status": "approved",
        "approved_by": admin_id,
        "expires_at": payload.expires_at.isoformat() if payload.expires_at else None,
    })
    return {"gateway": row}


@router.post("/mcp/runs", dependencies=[Depends(rate_limit(6, 60))])
async def run_registered_gateway(
    payload: GatewayRunRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    gateway = await store.one(
        "assurance_mcp_gateways",
        params={"id": f"eq.{payload.gateway_id}", "status": "eq.approved"},
    )
    if not gateway:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved gateway not found")
    if gateway.get("expires_at") and gateway["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gateway approval has expired")

    audit_base = {
        "gateway_id": str(payload.gateway_id),
        "actor_user_id": user_id,
        "goal_digest": sha256(payload.goal.encode("utf-8")).hexdigest(),
        "request_id": str(uuid.uuid4()),
    }
    try:
        target = await verify_public_https_target(
            gateway["origin"], expected_addresses=gateway.get("approved_addresses") or []
        )
        request_body = {
            "jsonrpc": "2.0",
            "id": audit_base["request_id"],
            "method": "tools/list",
            "params": {"request_context": {"goal": payload.goal, "max_steps": payload.max_steps}},
        }
        async with httpx.AsyncClient(timeout=get_settings().mcp_gateway_timeout_seconds, follow_redirects=False) as client:
            response = await client.post(target.url, json=request_body, headers={"Accept": "application/json"})
        if response.is_redirect:
            raise UnsafeRemoteTarget("Gateway redirects are not permitted")
        response.raise_for_status()
        body = response.json()
        await store.insert("assurance_mcp_audit_log", {**audit_base, "decision": "allowed", "target_origin": target.url, "resolved_addresses": list(target.addresses), "http_status": response.status_code})
        return {"run_id": audit_base["request_id"], "gateway": gateway["label"], "result": body}
    except (UnsafeRemoteTarget, httpx.HTTPError, ValueError) as exc:
        logger.warning("Secure MCP execution denied or failed: %s", exc)
        if store.configured:
            await store.insert("assurance_mcp_audit_log", {**audit_base, "decision": "denied", "deny_reason": str(exc)[:500]})
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Gateway request was blocked by security controls") from exc


@router.get("/public/status")
async def public_status() -> dict[str, Any]:
    incidents = await store.list("assurance_incidents", params={"select": "id,title,status,impact,started_at,resolved_at,updated_at", "order": "started_at.desc", "limit": "25"})
    maintenance = await store.list("assurance_maintenance_windows", params={"select": "id,title,starts_at,ends_at,status,description", "order": "starts_at.asc", "limit": "25"})
    components = await store.list("assurance_status_components", params={"select": "id,name,description,status,uptime_30d,updated_at", "order": "name.asc"})
    return {"components": components, "incidents": incidents, "maintenance": maintenance}


@router.post("/public/status-subscriptions", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(rate_limit(8, 3600))])
async def subscribe_status_updates(payload: StatusSubscriptionRequest) -> dict[str, str]:
    if bool(payload.email) == bool(payload.webhook_url):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide exactly one email or webhook destination")
    webhook_secret = ""
    verified = False
    if payload.webhook_url:
        try:
            target = await verify_public_https_target(payload.webhook_url)
        except UnsafeRemoteTarget as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        webhook_secret = get_settings().status_webhook_signing_secret
        if not webhook_secret:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook subscriptions are not configured")
        challenge = {"type": "d3vonn.status.subscription.challenge", "challenge": uuid.uuid4().hex}
        signature = build_webhook_signature(webhook_secret, challenge)
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
                response = await client.post(target.url, json=challenge, headers={"X-D3VONN-Signature": signature})
            verified = 200 <= response.status_code < 300
        except httpx.HTTPError:
            verified = False
    state = "verified" if verified else "pending_confirmation"
    row = await store.insert("assurance_status_subscriptions", {
        "email": payload.email,
        "webhook_url": payload.webhook_url,
        "webhook_secret": None,
        "status": state,
    })
    return {"status": row.get("status", state), "message": "Subscription recorded. Email subscriptions require delivery-provider verification."}


@router.get("/admin/overview")
async def get_assurance_overview(_: str = Depends(require_assurance_admin)) -> dict[str, Any]:
    remediations = await store.list("assurance_remediation_items", params={"select": "*", "order": "priority.asc,target_date.asc"})
    latest_performance = await store.list("assurance_performance_samples", params={"select": "route,metric_name,metric_value,source,created_at", "order": "created_at.desc", "limit": "100"})
    latest_a11y = await store.list("assurance_accessibility_audits", params={"select": "route,passed,violation_count,executed_at", "order": "executed_at.desc", "limit": "50"})
    return {"remediations": remediations, "performance": latest_performance, "accessibility": latest_a11y}


@router.patch("/admin/remediations/{item_id}")
async def update_remediation(
    item_id: str,
    payload: RemediationPatch,
    _: str = Depends(require_assurance_admin),
) -> dict[str, Any]:
    patch = payload.model_dump(exclude_none=True)
    if payload.target_date:
        patch["target_date"] = payload.target_date.isoformat()
    updated = await store.update("assurance_remediation_items", filters={"id": f"eq.{item_id}"}, patch=patch)
    return {"remediation": updated}
