"""
backend/app/security/detection.py — D3VONN Detection Engine

Evaluates incoming security events against configured detection rules.
When a rule's threshold is exceeded within the sliding window, an alert is created.

Supported detection patterns:
- brute_force_login: N failed logins from same actor in T seconds
- api_abuse: N rate-limit events from same IP in T seconds
- admin_privilege_escalation: Any role elevation to admin/operator
- token_reuse: Any presentation of a revoked/expired token
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


async def evaluate_event(supabase_client: Any, event: dict) -> Optional[dict]:
    """
    Evaluate a newly ingested security event against all enabled detection rules.

    Args:
        supabase_client: Authenticated Supabase client instance.
        event: The event dict as stored in security_events.

    Returns:
        Alert dict if a rule was triggered, else None.
    """
    event_type = event.get("event_type", "")
    actor = event.get("actor")
    ip = event.get("ip")

    # Fetch matching enabled rules
    rules_resp = (
        supabase_client.table("detection_rules")
        .select("*")
        .eq("event_type", event_type)
        .eq("enabled", True)
        .execute()
    )
    rules = rules_resp.data if rules_resp.data else []

    if not rules:
        return None

    for rule in rules:
        triggered = await _check_rule(supabase_client, rule, event)
        if triggered:
            alert = await _create_alert(supabase_client, rule, event)
            logger.warning(
                "Detection rule '%s' triggered for actor=%s ip=%s",
                rule["id"], actor, ip,
            )
            return alert

    return None


async def _check_rule(supabase_client: Any, rule: dict, event: dict) -> bool:
    """
    Check whether the rule threshold has been exceeded in the sliding window.
    """
    threshold = rule["threshold"]
    window_seconds = rule["window_seconds"]
    event_type = rule["event_type"]
    actor = event.get("actor")
    ip = event.get("ip")

    # For single-event rules (threshold=1), always trigger
    if threshold <= 1:
        return True

    # Calculate window start
    window_start = (
        datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    ).isoformat()

    # Build query — match by event_type within window
    query = (
        supabase_client.table("security_events")
        .select("id", count="exact")
        .eq("event_type", event_type)
        .gte("created_at", window_start)
    )

    # Narrow by actor or IP depending on what's available
    if actor:
        query = query.eq("actor", actor)
    elif ip:
        query = query.eq("ip", ip)

    result = query.execute()
    count = result.count if result.count is not None else len(result.data or [])

    return count >= threshold


async def _create_alert(supabase_client: Any, rule: dict, event: dict) -> dict:
    """
    Create a security alert from a triggered detection rule.
    """
    alert_data = {
        "rule_id": rule["id"],
        "title": f"[{rule['severity'].upper()}] {rule['name']}",
        "description": rule.get("description", ""),
        "severity": rule["severity"],
        "status": "open",
        "actor": event.get("actor"),
        "ip": event.get("ip"),
        "evidence": [{"event_id": str(event.get("id", "")), "event_type": event.get("event_type")}],
    }

    resp = (
        supabase_client.table("security_alerts")
        .insert(alert_data)
        .execute()
    )

    alert = resp.data[0] if resp.data else alert_data
    return alert


async def run_detection_sweep(supabase_client: Any, lookback_seconds: int = 300) -> list[dict]:
    """
    Run a full detection sweep over recent events (used for scheduled/cron evaluation).
    Returns list of newly created alerts.
    """
    window_start = (
        datetime.now(timezone.utc) - timedelta(seconds=lookback_seconds)
    ).isoformat()

    # Get all enabled rules
    rules_resp = (
        supabase_client.table("detection_rules")
        .select("*")
        .eq("enabled", True)
        .execute()
    )
    rules = rules_resp.data or []

    new_alerts: list[dict] = []

    for rule in rules:
        event_type = rule["event_type"]
        threshold = rule["threshold"]

        # Count events in window grouped by actor
        events_resp = (
            supabase_client.table("security_events")
            .select("actor, ip, id, event_type")
            .eq("event_type", event_type)
            .gte("created_at", window_start)
            .limit(500)
            .execute()
        )
        events = events_resp.data or []

        if not events:
            continue

        # Group by actor
        actor_counts: dict[str, list[dict]] = {}
        for ev in events:
            key = ev.get("actor") or ev.get("ip") or "unknown"
            actor_counts.setdefault(key, []).append(ev)

        for actor_key, actor_events in actor_counts.items():
            if len(actor_events) >= threshold:
                # Check if alert already exists for this rule+actor in last window
                existing = (
                    supabase_client.table("security_alerts")
                    .select("id")
                    .eq("rule_id", rule["id"])
                    .eq("actor", actor_key)
                    .eq("status", "open")
                    .gte("created_at", window_start)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    continue  # Already alerted

                sample_event = actor_events[0]
                alert = await _create_alert(supabase_client, rule, sample_event)
                new_alerts.append(alert)

    return new_alerts
