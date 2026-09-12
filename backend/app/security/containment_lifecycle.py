"""Lifecycle policy for temporary Cloudflare WAF containment.

This module only computes bounded TTL metadata and detects duplicate rules.
It does not schedule or perform autonomous rollback.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


DEFAULT_TTL_SECONDS = 3600
MAX_TTL_SECONDS = 86400
MIN_TTL_SECONDS = 60


def containment_ttl_seconds(action: dict[str, Any]) -> int:
    parameters = action.get("parameters") or {}
    details = action.get("details") or {}
    raw = parameters.get("ttl_seconds", details.get("ttl_seconds", DEFAULT_TTL_SECONDS))
    try:
        ttl = int(raw)
    except (TypeError, ValueError):
        ttl = DEFAULT_TTL_SECONDS
    return max(MIN_TTL_SECONDS, min(ttl, MAX_TTL_SECONDS))


def containment_expiry(action: dict[str, Any], *, now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    return (current + timedelta(seconds=containment_ttl_seconds(action))).isoformat()


def matching_waf_rule(rules: list[dict[str, Any]], expression: str) -> dict[str, Any] | None:
    """Return an existing enabled block rule for the exact expression."""
    wanted = expression.strip()
    for rule in rules:
        if (
            rule.get("action") == "block"
            and rule.get("enabled", True) is not False
            and str(rule.get("expression", "")).strip() == wanted
        ):
            return rule
    return None


def rollback_audit_record(*, ruleset_id: str, rule_id: str, target: str, actor_id: str) -> dict[str, Any]:
    return {
        "provider": "cloudflare",
        "provider_mode": "waf_custom_rule",
        "operation": "unblock_ip",
        "provider_ruleset_id": ruleset_id,
        "provider_rule_id": rule_id,
        "target": target,
        "actor_id": actor_id,
        "rolled_back_at": datetime.now(timezone.utc).isoformat(),
    }
