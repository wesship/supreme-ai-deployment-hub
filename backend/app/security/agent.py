"""
backend/app/security/agent.py — Governed Hermes Security Agent

This module provides the decision/audit layer for the D3VONN Cyber Command
Center. It may recommend containment actions, but destructive actions are not
reported as executed unless a separate approved executor actually performs them.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


AVAILABLE_ACTIONS = {
    "block_ip": "Block the source IP at the edge/firewall level",
    "revoke_token": "Revoke all active sessions for the actor",
    "notify_admin": "Send notification to security team",
    "quarantine_account": "Temporarily disable the actor's account",
    "escalate_incident": "Create or escalate to a security incident",
}

DESTRUCTIVE_ACTIONS = {
    "block_ip",
    "revoke_token",
    "quarantine_account",
}

AGENT_VERSION = "0.2.0-governed"


async def handle_alert(supabase_client: Any, alert: dict) -> Optional[dict]:
    """Evaluate an alert and persist a governed response recommendation.

    This function does not execute containment. It records the selected action,
    the governance state, and whether human approval is required. A separate
    executor must perform any destructive action after approval.
    """
    severity = str(alert.get("severity", "medium")).lower()
    rule_id = str(alert.get("rule_id", ""))
    alert_id = alert.get("id")

    logger.info(
        "Hermes Security Agent evaluating alert: id=%s rule=%s severity=%s",
        alert_id,
        rule_id,
        severity,
    )

    action_type = _determine_action(rule_id, severity)
    if not action_type:
        logger.info("No response recommendation required for alert %s", alert_id)
        return None

    requires_approval = action_type in DESTRUCTIVE_ACTIONS
    governance_state = "pending_approval" if requires_approval else "recommended"

    action_record = {
        "alert_id": str(alert_id) if alert_id else None,
        "action_type": action_type,
        "parameters": {
            "rule_id": rule_id,
            "actor": alert.get("actor"),
            "ip": alert.get("ip"),
            "severity": severity,
            "automated": False,
            "requires_approval": requires_approval,
            "governance_state": governance_state,
            "agent_version": AGENT_VERSION,
        },
        "result": governance_state,
        "agent_version": AGENT_VERSION,
    }

    try:
        resp = (
            supabase_client.table("hermes_security_actions")
            .insert(action_record)
            .execute()
        )
        recorded = resp.data[0] if resp.data else action_record
        logger.info(
            "Hermes Security Agent recorded %s recommendation for alert %s (state=%s)",
            action_type,
            alert_id,
            governance_state,
        )
        return recorded
    except Exception as exc:
        logger.error("Failed to record security recommendation: %s", exc)
        action_record["result"] = "record_failed"
        return action_record


def _determine_action(rule_id: str, severity: str) -> Optional[str]:
    """Select the minimum necessary response recommendation for an alert."""
    if severity == "critical":
        if rule_id == "admin_privilege_escalation":
            return "notify_admin"
        if rule_id == "token_reuse":
            return "revoke_token"
        return "notify_admin"

    if severity == "high":
        if rule_id in {"brute_force_login", "api_abuse"}:
            return "block_ip"
        return "notify_admin"

    return None


async def get_agent_actions(
    supabase_client: Any,
    limit: int = 20,
    alert_id: Optional[str] = None,
) -> list[dict]:
    """Retrieve recent agent recommendations/actions from the audit trail."""
    query = (
        supabase_client.table("hermes_security_actions")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )

    if alert_id:
        query = query.eq("alert_id", alert_id)

    resp = query.execute()
    return resp.data or []
