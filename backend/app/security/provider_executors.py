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
_CLOUDFLARE_WAF_ENABLED_ENV = "SECURITY_CLOUDFLARE_WAF_CONTAINMENT_ENABLED"
_CLOUDFLARE_ZONE_ENV = "CLOUDFLARE_ZONE_ID"
_CLOUDFLARE_TOKEN_ENV = "CLOUDFLARE_API_TOKEN"
_CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
_CLOUDFLARE_ZONE_RE = re.compile(r"^[0-9a-fA-F]{32}$")
_CLOUDFLARE_WAF_PHASE = "http_request_firewall_custom"


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


def _cloudflare_config(enabled_env: str) -> tuple[str, str] | None:
    if not _env_true(enabled_env):
        return None
    zone_id = os.getenv(_CLOUDFLARE_ZONE_ENV, "").strip()
    token = os.getenv(_CLOUDFLARE_TOKEN_ENV, "").strip()
    if not zone_id or not token or not _CLOUDFLARE_ZONE_RE.fullmatch(zone_id):
        return None
    return zone_id, token


def _cloudflare_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _parse_block_ip(action: dict[str, Any]) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    target = _approved_target(action, "block_ip")
    try:
        return ipaddress.ip_address(str(target))
    except ValueError:
        return None


async def cloudflare_block_ip_executor(action: dict[str, Any]) -> dict[str, Any]:
    """Create a legacy zone-scoped Cloudflare IP Access Rule for an approved IP."""
    if str(action.get("action_type", "")) != "block_ip":
        return {
            "status": "rejected",
            "provider": "cloudflare",
            "reason": "Cloudflare adapter only supports block_ip.",
        }

    config = _cloudflare_config(_CLOUDFLARE_ENABLED_ENV)
    if config is None:
        return {
            "status": "not_executed",
            "provider": "cloudflare",
            "reason": "Cloudflare containment is disabled or incompletely configured.",
        }

    parsed_ip = _parse_block_ip(action)
    if parsed_ip is None:
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

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=_cloudflare_headers(token), json=payload)
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
        "provider_mode": "ip_access_rule",
        "action_type": "block_ip",
        "target": str(parsed_ip),
        "external_side_effect": True,
        "provider_rule_id": result.get("id"),
    }


async def cloudflare_waf_block_ip_executor(action: dict[str, Any]) -> dict[str, Any]:
    """Add one approved IP block rule to the existing zone WAF custom entry point."""
    if str(action.get("action_type", "")) != "block_ip":
        return {
            "status": "rejected",
            "provider": "cloudflare",
            "provider_mode": "waf_custom_rule",
            "reason": "Cloudflare WAF adapter only supports block_ip.",
        }

    config = _cloudflare_config(_CLOUDFLARE_WAF_ENABLED_ENV)
    if config is None:
        return {
            "status": "not_executed",
            "provider": "cloudflare",
            "provider_mode": "waf_custom_rule",
            "reason": "Cloudflare WAF containment is disabled or incompletely configured.",
        }

    parsed_ip = _parse_block_ip(action)
    if parsed_ip is None:
        return {
            "status": "rejected",
            "provider": "cloudflare",
            "provider_mode": "waf_custom_rule",
            "reason": "Approved block_ip action does not contain a valid IP address.",
        }

    zone_id, token = config
    headers = _cloudflare_headers(token)
    entrypoint_url = (
        f"{_CLOUDFLARE_API_BASE}/zones/{zone_id}/rulesets/phases/"
        f"{_CLOUDFLARE_WAF_PHASE}/entrypoint"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            entrypoint = await client.get(entrypoint_url, headers=headers)
            if entrypoint.status_code == 404:
                return {
                    "status": "not_executed",
                    "provider": "cloudflare",
                    "provider_mode": "waf_custom_rule",
                    "reason": "Cloudflare WAF custom entry-point ruleset does not exist; bootstrap is required.",
                }

            try:
                entry_body = entrypoint.json()
            except ValueError:
                entry_body = {}
            if not entrypoint.is_success or entry_body.get("success") is not True:
                return {
                    "status": "error",
                    "provider": "cloudflare",
                    "provider_mode": "waf_custom_rule",
                    "http_status": entrypoint.status_code,
                    "reason": "Unable to resolve Cloudflare WAF custom entry-point ruleset.",
                }

            ruleset_id = str((entry_body.get("result") or {}).get("id") or "")
            if not ruleset_id:
                return {
                    "status": "error",
                    "provider": "cloudflare",
                    "provider_mode": "waf_custom_rule",
                    "reason": "Cloudflare WAF entry-point response did not include a ruleset ID.",
                }

            rule_url = f"{_CLOUDFLARE_API_BASE}/zones/{zone_id}/rulesets/{ruleset_id}/rules"
            payload = {
                "action": "block",
                "expression": f"(ip.src eq {parsed_ip})",
                "description": f"D3VONN approved containment action {action.get('id', '')}".strip(),
            }
            response = await client.post(rule_url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        return {
            "status": "error",
            "provider": "cloudflare",
            "provider_mode": "waf_custom_rule",
            "reason": f"Cloudflare WAF request failed: {exc.__class__.__name__}",
        }

    try:
        body = response.json()
    except ValueError:
        body = {}
    if not response.is_success or body.get("success") is not True:
        return {
            "status": "error",
            "provider": "cloudflare",
            "provider_mode": "waf_custom_rule",
            "http_status": response.status_code,
            "reason": "Cloudflare rejected the WAF custom rule request.",
        }

    result = body.get("result") or {}
    rule_id = result.get("id")
    if rule_id is None and isinstance(result.get("rules"), list) and result["rules"]:
        rule_id = result["rules"][-1].get("id")

    return {
        "status": "success",
        "provider": "cloudflare",
        "provider_mode": "waf_custom_rule",
        "action_type": "block_ip",
        "target": str(parsed_ip),
        "external_side_effect": True,
        "provider_ruleset_id": ruleset_id,
        "provider_rule_id": rule_id,
    }


def build_security_executors() -> dict[str, Executor]:
    """Build the explicit executor registry with fail-closed precedence.

    Precedence is dry-run, then WAF custom rules, then the legacy IP Access Rule
    adapter. Only one real `block_ip` implementation can be registered at once.
    """
    if _dry_run_enabled():
        return {action_type: dry_run_containment_executor for action_type in DESTRUCTIVE_ACTIONS}

    if _cloudflare_config(_CLOUDFLARE_WAF_ENABLED_ENV) is not None:
        return {"block_ip": cloudflare_waf_block_ip_executor}

    if _cloudflare_config(_CLOUDFLARE_ENABLED_ENV) is not None:
        return {"block_ip": cloudflare_block_ip_executor}

    return {}
