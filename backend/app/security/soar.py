"""
backend/app/security/soar.py — SOAR (Security Orchestration, Automation and Response) Engine

Executes governed playbooks in response to security alerts.
Supports:
- Playbook selection based on alert rule and severity
- Approval workflows for high-impact actions
- Cooldown enforcement to prevent alert storms
- Execution audit trail
- Fail-closed handling for destructive or unimplemented actions
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from backend.app.security.action_governance import classify_security_action

logger = logging.getLogger("d3vonn.soar")


class SOAREngine:
    """Security Orchestration, Automation and Response engine."""

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def handle_alert(self, alert: dict[str, Any]) -> dict[str, Any]:
        rule_id = alert.get("rule_id", "")
        severity = alert.get("severity", "medium")

        playbook = await self._find_playbook(rule_id, severity)
        if not playbook:
            return {"status": "no_playbook", "rule_id": rule_id}

        if not await self._check_cooldown(playbook):
            return {"status": "cooldown_active", "playbook": playbook.get("name")}

        if playbook.get("requires_approval"):
            return await self._request_approval(playbook, alert)

        return await self._execute_playbook(playbook, alert)

    async def _find_playbook(self, rule_id: str, severity: str) -> Optional[dict[str, Any]]:
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
            for pb in playbooks:
                if pb.get("trigger_severity") == severity:
                    return pb
            return playbooks[0]
        except Exception as exc:
            logger.error("Failed to find playbook: %s", exc)
            return None

    async def _check_cooldown(self, playbook: dict[str, Any]) -> bool:
        last_executed = playbook.get("last_executed")
        cooldown = playbook.get("cooldown_seconds", 300)
        if not last_executed:
            return True
        try:
            last_dt = datetime.fromisoformat(last_executed.replace("Z", "+00:00"))
            return datetime.now(timezone.utc) > last_dt + timedelta(seconds=cooldown)
        except (ValueError, TypeError):
            return True

    async def _request_approval(self, playbook: dict[str, Any], alert: dict[str, Any]) -> dict[str, Any]:
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
        steps = playbook.get("steps", [])
        results: list[dict[str, Any]] = []

        for i, step in enumerate(steps):
            results.append(await self._execute_step(step, alert, i + 1))

        successful = sum(1 for result in results if result.get("status") == "success")
        pending = sum(1 for result in results if result.get("status") == "pending_approval")
        failed = sum(1 for result in results if result.get("status") == "failed")
        not_executed = sum(1 for result in results if result.get("status") == "not_executed")

        if pending:
            overall_status = "pending_approval"
        elif failed or not_executed:
            overall_status = "partial"
        else:
            overall_status = "completed"

        if overall_status == "completed":
            try:
                self.db.table("security_playbooks").update({
                    "last_executed": datetime.now(timezone.utc).isoformat(),
                    "execution_count": playbook.get("execution_count", 0) + 1,
                }).eq("id", playbook["id"]).execute()
            except Exception:
                pass

        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": "soar_engine",
                "action_type": "playbook_evaluated",
                "target": playbook.get("name"),
                "details": {
                    "playbook_id": playbook.get("id"),
                    "steps_total": len(steps),
                    "steps_succeeded": successful,
                    "steps_pending_approval": pending,
                    "steps_not_executed": not_executed,
                    "alert": alert,
                    "results": results,
                },
                "status": overall_status,
            }).execute()
        except Exception:
            pass

        return {
            "status": overall_status,
            "playbook": playbook.get("name"),
            "steps_total": len(steps),
            "steps_succeeded": successful,
            "steps_pending_approval": pending,
            "steps_not_executed": not_executed,
            "results": results,
        }

    async def _execute_step(self, step: dict[str, Any], alert: dict[str, Any], step_num: int) -> dict[str, Any]:
        action = step.get("action", "unknown")
        params = step.get("params", {})
        handler = self.ACTION_HANDLERS.get(action)
        implemented = handler is not None and action in self.IMPLEMENTED_NON_DESTRUCTIVE_ACTIONS
        decision = classify_security_action(action, implemented=implemented)

        logger.info(
            "SOAR evaluating step %d: %s status=%s requires_approval=%s",
            step_num,
            action,
            decision.status,
            decision.requires_approval,
        )

        if decision.requires_approval:
            return {
                "step": action,
                "status": "pending_approval",
                "message": decision.reason,
                "details": {"params": params, "alert_id": alert.get("id")},
            }

        if not decision.executable or handler is None:
            return {
                "step": action,
                "status": "not_executed",
                "message": decision.reason,
                "details": {"params": params, "alert_id": alert.get("id")},
            }

        return await handler(self, action, params, alert)

    async def _handle_notify(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        """Record a notification recommendation; no external delivery is claimed."""
        channel = params.get("channel", "email")
        return {
            "step": action,
            "status": "not_executed",
            "message": f"Notification via {channel} is recommended; external delivery executor is not wired here.",
            "details": {"channel": channel, "alert_id": alert.get("id")},
        }

    async def _handle_create_incident(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
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

    async def _handle_generate_report(self, action: str, params: dict, alert: dict) -> dict[str, Any]:
        return {
            "step": action,
            "status": "not_executed",
            "message": "Incident report generation is recommended; no report executor is wired here.",
        }

    IMPLEMENTED_NON_DESTRUCTIVE_ACTIONS = frozenset({"create_incident"})

    ACTION_HANDLERS = {
        "notify_user": _handle_notify,
        "notify_admin": _handle_notify,
        "alert_soc": _handle_notify,
        "notify_repo_owner": _handle_notify,
        "create_incident": _handle_create_incident,
        "generate_report": _handle_generate_report,
    }
