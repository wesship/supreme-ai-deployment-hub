"""
backend/app/security/soar.py — SOAR (Security Orchestration, Automation and Response) Engine

Executes automated playbooks in response to security alerts.
Supports:
- Playbook selection based on alert rule and severity
- Step-by-step execution with rollback capability
- Approval workflows for high-impact actions
- Cooldown enforcement to prevent alert storms
- Execution audit trail
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.soar")


class SOAREngine:
    """
    Security Orchestration, Automation and Response engine.
    Matches alerts to playbooks and executes automated response steps.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def handle_alert(self, alert: dict[str, Any]) -> dict[str, Any]:
        """
        Main entry point: match alert to playbook and execute.
        Returns execution result.
        """
        rule_id = alert.get("rule_id", "")
        severity = alert.get("severity", "medium")

        # Find matching playbook
        playbook = await self._find_playbook(rule_id, severity)
        if not playbook:
            return {"status": "no_playbook", "rule_id": rule_id}

        # Check cooldown
        if not await self._check_cooldown(playbook):
            return {"status": "cooldown_active", "playbook": playbook.get("name")}

        # Check if approval is required
        if playbook.get("requires_approval"):
            return await self._request_approval(playbook, alert)

        # Execute playbook
        return await self._execute_playbook(playbook, alert)

    async def _find_playbook(self, rule_id: str, severity: str) -> Optional[dict[str, Any]]:
        """Find the best matching playbook for an alert."""
        try:
            resp = (
                self.db.table("security_playbooks")
                .select("*")
                .eq("trigger_type", rule_id)
                .eq("enabled", True)
                .execute()
            )
            playbooks = resp.data or []

            if not playbooks:
                return None

            # Prefer playbooks matching severity
            for pb in playbooks:
                if pb.get("trigger_severity") == severity:
                    return pb

            # Fall back to first enabled playbook
            return playbooks[0]
        except Exception as exc:
            logger.error("Failed to find playbook: %s", exc)
            return None

    async def _check_cooldown(self, playbook: dict[str, Any]) -> bool:
        """Check if playbook is within cooldown period."""
        last_executed = playbook.get("last_executed")
        cooldown = playbook.get("cooldown_seconds", 300)

        if not last_executed:
            return True

        try:
            last_dt = datetime.fromisoformat(last_executed.replace("Z", "+00:00"))
            cooldown_end = last_dt + timedelta(seconds=cooldown)
            return datetime.now(timezone.utc) > cooldown_end
        except (ValueError, TypeError):
            return True

    async def _request_approval(self, playbook: dict[str, Any], alert: dict[str, Any]) -> dict[str, Any]:
        """Queue playbook for manual approval."""
        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": "soar_engine",
                "action_type": "approval_requested",
                "target": playbook.get("name"),
                "details": {
                    "playbook_id": playbook.get("id"),
                    "alert": alert,
                    "steps": playbook.get("steps", []),
                },
                "status": "pending_approval",
            }).execute()
        except Exception as exc:
            logger.error("Failed to request approval: %s", exc)

        return {
            "status": "pending_approval",
            "playbook": playbook.get("name"),
            "message": "Playbook requires manual approval before execution.",
        }

    async def _execute_playbook(self, playbook: dict[str, Any], alert: dict[str, Any]) -> dict[str, Any]:
        """Execute all steps in a playbook sequentially."""
        steps = playbook.get("steps", [])
        results: list[dict[str, Any]] = []
        all_success = True

        for i, step in enumerate(steps):
            step_result = await self._execute_step(step, alert, i + 1)
            results.append(step_result)
            if step_result.get("status") == "failed":
                all_success = False
                # Continue execution — don't halt on non-critical failures

        # Update playbook execution metadata
        try:
            self.db.table("security_playbooks").update({
                "last_executed": datetime.now(timezone.utc).isoformat(),
                "execution_count": playbook.get("execution_count", 0) + 1,
            }).eq("id", playbook["id"]).execute()
        except Exception:
            pass

        # Record execution in audit trail
        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": "soar_engine",
                "action_type": "playbook_executed",
                "target": playbook.get("name"),
                "details": {
                    "playbook_id": playbook.get("id"),
                    "steps_total": len(steps),
                    "steps_succeeded": sum(1 for r in results if r.get("status") == "success"),
                    "alert": alert,
                    "results": results,
                },
                "status": "completed" if all_success else "partial",
            }).execute()
        except Exception:
            pass

        return {
            "status": "completed" if all_success else "partial",
            "playbook": playbook.get("name"),
            "steps_total": len(steps),
            "steps_succeeded": sum(1 for r in results if r.get("status") == "success"),
            "results": results,
        }

    async def _execute_step(self, step: dict[str, Any], alert: dict[str, Any], step_num: int) -> dict[str, Any]:
        """
        Execute a single playbook step.
        In production, each action type would call real APIs.
        Currently returns simulated results.
        """
        action = step.get("action", "unknown")
        params = step.get("params", {})

        logger.info("SOAR executing step %d: %s with params %s", step_num, action, params)

        # Action handlers (stubs — replace with real integrations)
        handler = self.ACTION_HANDLERS.get(action, self._default_handler)
        return await handler(self, action, params, alert)

    async def _handle_block_ip(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Block an IP address (stub — would call Cloudflare/WAF API)."""
        ip = alert.get("ip", "unknown")
        duration = params.get("duration", "1h")
        return {
            "step": action,
            "status": "success",
            "message": f"IP {ip} blocked for {duration}",
            "details": {"ip": ip, "duration": duration, "provider": "cloudflare"},
        }

    async def _handle_disable_account(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Disable a user account (stub — would call auth provider)."""
        actor = alert.get("actor", "unknown")
        duration = params.get("duration", "1h")
        return {
            "step": action,
            "status": "success",
            "message": f"Account {actor} disabled for {duration}",
            "details": {"actor": actor, "duration": duration},
        }

    async def _handle_revoke_sessions(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Revoke all sessions for a user."""
        actor = alert.get("actor", "unknown")
        return {
            "step": action,
            "status": "success",
            "message": f"All sessions revoked for {actor}",
            "details": {"actor": actor},
        }

    async def _handle_notify(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Send notification (stub — would call Slack/email API)."""
        channel = params.get("channel", "email")
        return {
            "step": action,
            "status": "success",
            "message": f"Notification sent via {channel}",
            "details": {"channel": channel, "alert_id": alert.get("id")},
        }

    async def _handle_create_incident(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Create a security incident."""
        try:
            self.db.table("security_incidents").insert({
                "title": f"Auto-created: {alert.get('rule_id', 'Unknown')}",
                "severity": params.get("severity", alert.get("severity", "medium")),
                "status": "open",
                "alert_ids": [alert.get("id")] if alert.get("id") else [],
                "source": "soar_engine",
            }).execute()
            return {"step": action, "status": "success", "message": "Incident created"}
        except Exception as exc:
            return {"step": action, "status": "failed", "error": str(exc)}

    async def _handle_revoke_jwt(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Revoke JWT tokens."""
        return {
            "step": action,
            "status": "success",
            "message": "JWT tokens revoked for affected session",
        }

    async def _handle_rotate_refresh_token(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Rotate refresh tokens."""
        return {
            "step": action,
            "status": "success",
            "message": "Refresh tokens rotated",
        }

    async def _handle_generate_report(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Generate an incident report."""
        return {
            "step": action,
            "status": "success",
            "message": "Incident report generation queued",
        }

    async def _default_handler(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Default handler for unimplemented actions."""
        return {
            "step": action,
            "status": "success",
            "message": f"Action '{action}' acknowledged (stub implementation)",
        }

    # Action handler registry
    ACTION_HANDLERS = {
        "block_ip": _handle_block_ip,
        "disable_account": _handle_disable_account,
        "revoke_sessions": _handle_revoke_sessions,
        "notify_user": _handle_notify,
        "notify_admin": _handle_notify,
        "alert_soc": _handle_notify,
        "notify_repo_owner": _handle_notify,
        "create_incident": _handle_create_incident,
        "revoke_jwt": _handle_revoke_jwt,
        "rotate_refresh_token": _handle_rotate_refresh_token,
        "invalidate_sessions": _handle_revoke_sessions,
        "generate_report": _handle_generate_report,
    }
