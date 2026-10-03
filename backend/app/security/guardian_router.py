"""Client-safe D3VONN Security Guardian pilot API.

This router deliberately does not expose the legacy service-role SOC v2 API.
Every client operation is authenticated and server-side tenant membership is
re-checked before service-role database access is used.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.client_ai.auth import ClientAIPrincipal, require_client_ai_user

router = APIRouter(prefix="/api/security/guardian", tags=["security-guardian"])

_ALLOWED_CERT_ROLES = frozenset({"owner", "admin", "security_manager"})
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=3, max_length=64)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        value = value.strip().lower()
        if not _SLUG_RE.fullmatch(value):
            raise ValueError("slug must use lowercase letters, numbers, and hyphens")
        return value


class GuardianEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=120)
    severity: Literal["info", "low", "medium", "high", "critical"] = "medium"
    source: str = Field(min_length=1, max_length=120)
    actor: str | None = Field(default=None, max_length=320)
    ip_address: str | None = None
    occurred_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("event_type", "source")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("ip_address")
    @classmethod
    def validate_ip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return str(ipaddress.ip_address(value.strip()))

    @field_validator("metadata")
    @classmethod
    def bound_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        encoded = json.dumps(value, separators=(",", ":"), default=str).encode("utf-8")
        if len(encoded) > 32_768:
            raise ValueError("metadata exceeds 32 KiB pilot limit")
        return value


def get_db():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Security Guardian data store is not configured.",
        )
    return create_client(url, key)


def _membership(db: Any, organization_id: str, user_id: str) -> dict[str, Any]:
    response = (
        db.table("security_guardian_memberships")
        .select("organization_id,user_id,role,status")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization access denied.")
    return rows[0]


def _require_role(membership: dict[str, Any], allowed: frozenset[str]) -> None:
    if membership.get("role") not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient organization role.")


def _canonical_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    db = get_db()
    try:
        org_response = db.table("security_guardian_organizations").insert(
            {"name": body.name, "slug": body.slug, "owner_user_id": principal.user_id, "status": "pilot"}
        ).execute()
        if not org_response.data:
            raise RuntimeError("organization insert returned no row")
        organization = org_response.data[0]
        try:
            db.table("security_guardian_memberships").insert(
                {"organization_id": organization["id"], "user_id": principal.user_id, "role": "owner", "status": "active"}
            ).execute()
        except Exception:
            db.table("security_guardian_organizations").delete().eq("id", organization["id"]).execute()
            raise
        return {"organization": organization, "role": "owner"}
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization slug already exists.") from exc
        raise HTTPException(status_code=500, detail="Could not create Security Guardian organization.") from exc


@router.get("/organizations")
async def list_organizations(principal: ClientAIPrincipal = Depends(require_client_ai_user)):
    db = get_db()
    memberships = (
        db.table("security_guardian_memberships")
        .select("organization_id,role,status")
        .eq("user_id", principal.user_id)
        .eq("status", "active")
        .execute()
    ).data or []
    result: list[dict[str, Any]] = []
    for membership in memberships:
        org_rows = (
            db.table("security_guardian_organizations")
            .select("id,name,slug,status,created_at")
            .eq("id", membership["organization_id"])
            .limit(1)
            .execute()
        ).data or []
        if org_rows:
            result.append({**org_rows[0], "role": membership.get("role")})
    return {"organizations": result}


@router.post("/organizations/{organization_id}/events", status_code=status.HTTP_201_CREATED)
async def ingest_client_event(
    organization_id: str,
    body: GuardianEventCreate,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    db = get_db()
    _membership(db, organization_id, principal.user_id)
    occurred_at = body.occurred_at or datetime.now(timezone.utc)
    payload = {
        "organization_id": organization_id,
        "event_type": body.event_type,
        "severity": body.severity,
        "source": body.source,
        "actor": body.actor,
        "ip_address": body.ip_address,
        "occurred_at": occurred_at.isoformat(),
        "metadata": body.metadata,
        "synthetic": False,
        "created_by": principal.user_id,
    }
    response = db.table("security_guardian_events").insert(payload).execute()
    return {"status": "ingested", "event": (response.data or [payload])[0]}


@router.get("/organizations/{organization_id}/overview")
async def organization_overview(
    organization_id: str,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    db = get_db()
    membership = _membership(db, organization_id, principal.user_id)
    events = (
        db.table("security_guardian_events")
        .select("id,event_type,severity,source,occurred_at,synthetic")
        .eq("organization_id", organization_id)
        .order("occurred_at", desc=True)
        .limit(500)
        .execute()
    ).data or []
    severe = [row for row in events if row.get("severity") in {"high", "critical"}]
    critical = [row for row in events if row.get("severity") == "critical"]
    return {
        "organization_id": organization_id,
        "role": membership.get("role"),
        "protection_status": "pilot",
        "events_observed": len(events),
        "high_or_critical": len(severe),
        "critical": len(critical),
        "recent_events": events[:20],
    }


@router.post("/organizations/{organization_id}/pilot/simulate")
async def simulate_account_takeover(
    organization_id: str,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    """Seed a non-executing, synthetic account-takeover sequence for certification."""
    db = get_db()
    membership = _membership(db, organization_id, principal.user_id)
    _require_role(membership, _ALLOWED_CERT_ROLES)
    now = datetime.now(timezone.utc).isoformat()
    events = [
        ("authentication.new_device", "medium"),
        ("authentication.login", "high"),
        ("identity.mfa_removed", "critical"),
        ("token.oauth_created", "critical"),
        ("response.approval_required", "high"),
    ]
    inserted: list[dict[str, Any]] = []
    for event_type, severity in events:
        row = {
            "organization_id": organization_id,
            "event_type": event_type,
            "severity": severity,
            "source": "guardian_pilot_simulator",
            "actor": principal.email or principal.user_id,
            "ip_address": "203.0.113.10",
            "occurred_at": now,
            "metadata": {"simulation": "account_takeover", "non_executing": True},
            "synthetic": True,
            "created_by": principal.user_id,
        }
        response = db.table("security_guardian_events").insert(row).execute()
        inserted.extend(response.data or [row])
    return {"status": "simulated", "non_executing": True, "events_created": len(inserted)}


@router.post("/organizations/{organization_id}/pilot/certify")
async def certify_pilot(
    organization_id: str,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    db = get_db()
    membership = _membership(db, organization_id, principal.user_id)
    _require_role(membership, _ALLOWED_CERT_ROLES)

    synthetic = (
        db.table("security_guardian_events")
        .select("id,event_type,organization_id")
        .eq("organization_id", organization_id)
        .eq("synthetic", True)
        .limit(20)
        .execute()
    ).data or []

    try:
        from backend.app.security.approval_execution import ApprovalExecutionService  # noqa: F401
        approval_gate_present = True
    except Exception:
        approval_gate_present = False

    pilot_mode = os.getenv("SECURITY_GUARDIAN_PILOT_MODE", "").strip().lower() == "true"
    automation_mode = os.getenv("SECURITY_GUARDIAN_AUTOMATION_MODE", "monitor_only").strip().lower()
    safe_automation = automation_mode in {"monitor_only", "approval_only"}
    tenant_bound_simulation = len(synthetic) >= 5 and all(
        str(row.get("organization_id")) == str(organization_id) for row in synthetic
    )

    checks = {
        "authenticated_client_boundary": True,
        "active_tenant_membership": True,
        "tenant_bound_simulation": tenant_bound_simulation,
        "approval_execution_gate_present": approval_gate_present,
        "safe_automation_mode": safe_automation,
        "pilot_mode_enabled": pilot_mode,
    }
    blockers = [name for name, passed in checks.items() if not passed]
    score = round(100 * sum(1 for passed in checks.values() if passed) / len(checks))
    cert_status = "certified" if not blockers else "blocked"
    snapshot = {
        "organization_id": organization_id,
        "checks": checks,
        "blockers": blockers,
        "automation_mode": automation_mode,
        "score": score,
        "status": cert_status,
    }
    row = {
        "organization_id": organization_id,
        "status": cert_status,
        "score": score,
        "checks": checks,
        "blockers": blockers,
        "evidence_hash": _canonical_hash(snapshot),
        "certified_by": principal.user_id if cert_status == "certified" else None,
        "certified_at": datetime.now(timezone.utc).isoformat() if cert_status == "certified" else None,
    }
    response = db.table("security_guardian_pilot_certifications").insert(row).execute()
    stored = (response.data or [row])[0]
    return {"certification": stored, "automation_mode": automation_mode}


@router.get("/organizations/{organization_id}/pilot/certification")
async def latest_certification(
    organization_id: str,
    principal: ClientAIPrincipal = Depends(require_client_ai_user),
):
    db = get_db()
    _membership(db, organization_id, principal.user_id)
    rows = (
        db.table("security_guardian_pilot_certifications")
        .select("*")
        .eq("organization_id", organization_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pilot certification has been run.")
    return {"certification": rows[0]}
