"""Audited security containment executor registry.

Dry-run remains the safest validation path. Real provider adapters are explicit,
provider-scoped, approval-gated, and disabled unless their feature flag and
required credentials are configured.
"""

from __future__ import annotations

import ipaddress
import os
import re
from typing import Any

import httpx

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS
from backend.app.security.approval_execution import Executor


_DRY_RUN_ENV = "SECURITY_CONTAINMENT_DRY_RUN"
_CLOUDFLARE_ENABLED_ENV = "SECURITY_CLOUDFLARE_CONTAINMENT_ENABLED"
_CLOUDFLARE_ZONE_ENV = "CLOUDFLARE_ZONE_ID"
_CLOUDFLARE_TOKEN_ENV = "CLOUDFLARE_API_TOKEN"
_CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
_CLOUDFLARE_ZONE_RE = re.compile(r"^[0-9a-fA-F]{32}$")


def _env_true(name: str) -> bool:
    return os.getenv(name, "false").strip().lower() == "true"


def _dry_run_enabled() -> bool:
    return _env_true(_DRY_RUN_ENV)


def _approved_target(action: dict[str, Any], action_type: str) -> Any:
    """Resolve the auditable target from the persisted governed action payload."""
    parameters = action.get("parameters") or {}
    details = action.get("details") or {}

    if action_type == "block_ip":
        return parameters.get("ip") or details.get("ip") or details.get("target")
    if action_type in {"revoke_token", "quarantine_account"}:
        return (
            parameters.get("actor")
            or parameters.get("user_id")
            or details.get("user_id")
            or details.get("target")
        )
    return details.get("target")


async def dry_run_containment_executor(action: dict[str, Any]) -> dict[str, Any]:
    """Return an auditable simulation result without performing containment."""
    action_type = str(action.get("action_type", ""))
    if action_type not in DESTRUCTIVE_ACTIONS:
        return {
            "status": "rejected",
            "provider": "dry_run",
            "reason": "Dry-run containment only accepts governed destructive actions.",
        }

    if not _dry_run_enabled():
        return {
            "status": "not_executed",
            "provider": "dry_run",
            "reason": f"{_DRY_RUN_ENV}=true is required for dry-run containment.",
        }

    return {
        "status": "dry_run",
        "provider": "dry_run",
        "action_type": action_type,
        "target": _approved_target(action, action_type),
        "external_side_effect": False,
        "reason": "Containment simulated only; no external system was modified.",
    }


def _cloudflare_config() -> tuple[str, str] | None:
    if not _env_true(_CLOUDFLARE_ENABLED_ENV):
        return None
    zone_id = os.getenv(_CLOUDFLARE_ZONE_ENV, "").strip()
    token = os.getenv(_CLOUDFLARE_TOKEN_ENV, "").strip()
    if not zone_id or not token or not _CLOUDFLARE_ZONE_RE.fullmatch(zone_id):
        return None
    return zone_id, token


async def cloudflare_block_ip_executor(action: dict[str, Any]) -> dict[str, Any]:
    """Create a zone-scoped Cloudflare IP Access Rule for one approved IP target."""
    if str(action.get("action_type", "")) != "block_ip":
        return {
            "status": "rejected",
            "provider": "cloudflare",
            "reason": "Cloudflare adapter only supports block_ip.",
        }

    config = _cloudflare_config()
    if config is None:
        return {
            "status": "not_executed",
            "provider": "cloudflare",
            "reason": "Cloudflare containment is disabled or incompletely configured.",
        }

    target = _approved_target(action, "block_ip")
    try:
        parsed_ip = ipaddress.ip_address(str(target))
    except ValueError:
        return {
            "status": "rejected",
            "provider": "cloudflare",
            "reason": "Approved block_ip action does not contain a valid IP address.",
        }

    zone_id, token = config
    target_kind = "ip6" if parsed_ip.version == 6 else "ip"
    url = f"{_CLOUDFLARE_API_BASE}/zones/{zone_id}/firewall/access_rules/rules"
    payload = {
        "mode": "block",
        "configuration": {"target": target_kind, "value": str(parsed_ip)},
        "notes": f"D3VONN approved containment action {action.get('id', '')}".strip(),
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        return {
            "status": "error",
            "provider": "cloudflare",
            "reason": f"Cloudflare request failed: {exc.__class__.__name__}",
        }

    try:
        body = response.json()
    except ValueError:
        body = {}

    if not response.is_success or body.get("success") is not True:
        return {
            "status": "error",
            "provider": "cloudflare",
            "http_status": response.status_code,
            "reason": "Cloudflare rejected the containment request.",
        }

    result = body.get("result") or {}
    return {
        "status": "success",
        "provider": "cloudflare",
        "action_type": "block_ip",
        "target": str(parsed_ip),
        "external_side_effect": True,
        "provider_rule_id": result.get("id"),
    }


def build_security_executors() -> dict[str, Executor]:
    """Build the explicit executor registry with fail-closed precedence.

    Dry-run mode takes precedence over every real provider so a simulation flag
    can never accidentally produce a real external side effect. When dry-run is
    off, Cloudflare registers only `block_ip` and only with complete config.
    """
    if _dry_run_enabled():
        return {action_type: dry_run_containment_executor for action_type in DESTRUCTIVE_ACTIONS}

    executors: dict[str, Executor] = {}
    if _cloudflare_config() is not None:
        executors["block_ip"] = cloudflare_block_ip_executor
    return executors
