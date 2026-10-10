"""
Incident Commander Agent — Manages incident lifecycle and coordination.

Responsibilities:
- Incident triage and severity classification
- Team coordination and task assignment
- Timeline management
- Communication templates
- Post-incident review orchestration
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("d3vonn.agents.incident_commander")


class IncidentCommanderAgent:
    """Manages the full incident response lifecycle."""

    AGENT_ID = "incident_commander"
    AGENT_NAME = "Incident Commander"
    CAPABILITIES = [
        "incident_triage",
        "severity_classification",
        "team_coordination",
        "timeline_management",
        "communication",
        "post_incident_review",
    ]

    def __init__(self, supabase_client: Any, llm_client: Any = None):
        self.db = supabase_client
        self.llm = llm_client

    async def triage_incident(self, incident_id: str) -> dict[str, Any]:
        """Perform initial triage on a new incident."""
        try:
            incident = (
                self.db.table("security_incidents")
                .select("*")
                .eq("id", incident_id)
                .limit(1)
                .execute()
            )
            if not incident.data:
                return {"error": "Incident not found"}

            inc = incident.data[0]

            # Get related alerts
            alerts = (
                self.db.table("security_alerts")
                .select("severity, rule_id, actor, ip")
                .eq("incident_id", incident_id)
                .execute()
            )

            alert_count = len(alerts.data or [])
            severities = [a.get("severity") for a in (alerts.data or [])]

            # Determine severity
            if "critical" in severities:
                severity = "critical"
            elif severities.count("high") >= 3:
                severity = "critical"
            elif "high" in severities:
                severity = "high"
            else:
                severity = "medium"

            # Determine category
            actors = set(a.get("actor") for a in (alerts.data or []) if a.get("actor"))
            ips = set(a.get("ip") for a in (alerts.data or []) if a.get("ip"))

            triage_result = {
                "incident_id": incident_id,
                "severity": severity,
                "alert_count": alert_count,
                "unique_actors": len(actors),
                "unique_ips": len(ips),
                "recommended_actions": self._get_recommended_actions(severity),
                "assigned_team": self._assign_team(severity),
                "sla_hours": self._get_sla(severity),
                "communication_required": severity in ("critical", "high"),
            }

            # Update incident
            self.db.table("security_incidents").update({
                "severity": severity,
                "status": "triaged",
                "metadata": {"triage": triage_result},
            }).eq("id", incident_id).execute()

            await self._log_action("triage_incident", triage_result)
            return triage_result

        except Exception as exc:
            return {"error": str(exc)}

    async def generate_communication(self, incident_id: str, audience: str = "internal") -> dict[str, Any]:
        """Generate incident communication for the specified audience."""
        templates = {
            "internal": {
                "subject": "Security Incident #{id} — {severity}",
                "body": (
                    "A {severity} security incident has been identified.\n\n"
                    "Incident ID: {id}\n"
                    "Status: {status}\n"
                    "Affected: {actors}\n"
                    "Source IPs: {ips}\n\n"
                    "The incident response team has been engaged. "
                    "Updates will follow every {update_interval}."
                ),
            },
            "executive": {
                "subject": "Security Incident Brief — {severity}",
                "body": (
                    "Summary: A {severity} security event is under investigation.\n"
                    "Impact: {impact}\n"
                    "Status: {status}\n"
                    "ETA for resolution: {eta}\n"
                    "Business risk: {risk}\n"
                ),
            },
            "customer": {
                "subject": "Service Security Notice",
                "body": (
                    "We are investigating a security event that may affect your account. "
                    "No action is required at this time. "
                    "We will provide updates as our investigation progresses."
                ),
            },
        }

        template = templates.get(audience, templates["internal"])
        return {
            "audience": audience,
            "template": template,
            "incident_id": incident_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    async def create_timeline(self, incident_id: str) -> list[dict[str, Any]]:
        """Build an incident timeline from related events and alerts."""
        timeline: list[dict[str, Any]] = []

        try:
            # Get events
            events = (
                self.db.table("security_events")
                .select("event_type, severity, actor, ip, created_at")
                .eq("metadata->>incident_id", incident_id)
                .order("created_at")
                .limit(100)
                .execute()
            )

            for event in (events.data or []):
                timeline.append({
                    "timestamp": event.get("created_at"),
                    "type": "event",
                    "description": f"{event.get('event_type')} from {event.get('actor', 'unknown')}",
                    "severity": event.get("severity"),
                })

            # Get alerts
            alerts = (
                self.db.table("security_alerts")
                .select("rule_id, severity, description, created_at")
                .eq("incident_id", incident_id)
                .order("created_at")
                .execute()
            )

            for alert in (alerts.data or []):
                timeline.append({
                    "timestamp": alert.get("created_at"),
                    "type": "alert",
                    "description": alert.get("description", f"Alert: {alert.get('rule_id')}"),
                    "severity": alert.get("severity"),
                })

        except Exception as exc:
            logger.error("Timeline creation failed: %s", exc)

        timeline.sort(key=lambda x: x.get("timestamp", ""))
        return timeline

    @staticmethod
    def _get_recommended_actions(severity: str) -> list[str]:
        actions = {
            "critical": [
                "Activate incident response team immediately",
                "Isolate affected systems",
                "Preserve evidence",
                "Notify CISO and legal",
                "Begin containment procedures",
            ],
            "high": [
                "Engage security team within 1 hour",
                "Assess blast radius",
                "Begin investigation",
                "Prepare containment plan",
            ],
            "medium": [
                "Investigate within 4 hours",
                "Assess scope and impact",
                "Document findings",
            ],
            "low": [
                "Review during next business day",
                "Document for trend analysis",
            ],
        }
        return actions.get(severity, actions["medium"])

    @staticmethod
    def _assign_team(severity: str) -> str:
        teams = {
            "critical": "soc_tier3_and_management",
            "high": "soc_tier2",
            "medium": "soc_tier1",
            "low": "soc_tier1",
        }
        return teams.get(severity, "soc_tier1")

    @staticmethod
    def _get_sla(severity: str) -> int:
        slas = {"critical": 1, "high": 4, "medium": 24, "low": 72}
        return slas.get(severity, 24)

    async def _log_action(self, action_type: str, details: dict[str, Any]):
        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": "Incident Commander",
                "action_type": action_type,
                "details": details,
                "status": "completed",
            }).execute()
        except Exception:
            pass
