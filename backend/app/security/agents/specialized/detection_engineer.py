"""
Detection Engineer Agent — Creates, tunes, and validates detection rules.

Responsibilities:
- Analyze missed detections and create new rules
- Tune existing rules to reduce false positives
- Validate rule coverage against MITRE ATT&CK
- Suggest rule improvements based on alert feedback
- Generate detection-as-code artifacts
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.agents.detection_engineer")


class DetectionEngineerAgent:
    """AI agent specialized in detection rule engineering."""

    AGENT_ID = "detection_engineer"
    AGENT_NAME = "Detection Engineer"
    CAPABILITIES = [
        "rule_creation",
        "rule_tuning",
        "coverage_analysis",
        "false_positive_reduction",
        "mitre_mapping",
    ]

    def __init__(self, supabase_client: Any, llm_client: Any = None):
        self.db = supabase_client
        self.llm = llm_client

    async def analyze_missed_detection(self, incident_id: str) -> dict[str, Any]:
        """Analyze an incident that was not caught by existing rules and propose new rules."""
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

            # Get related events
            events = (
                self.db.table("security_events")
                .select("*")
                .eq("metadata->>incident_id", incident_id)
                .order("created_at")
                .limit(50)
                .execute()
            )

            # Analyze patterns
            event_types = [e.get("event_type") for e in (events.data or [])]
            actors = set(e.get("actor") for e in (events.data or []))
            ips = set(e.get("ip") for e in (events.data or []))

            proposed_rule = {
                "rule_id": f"AUTO-{int(datetime.now(timezone.utc).timestamp())}",
                "name": f"Detection for incident pattern: {incident.data[0].get('title', 'unknown')}",
                "description": f"Auto-generated rule based on missed incident {incident_id}",
                "event_types": list(set(event_types)),
                "actors_involved": list(actors),
                "ips_involved": list(ips),
                "suggested_threshold": max(1, len(events.data or []) // 2),
                "suggested_window_minutes": 30,
                "status": "draft",
                "confidence": 60,
            }

            await self._log_action("analyze_missed_detection", {
                "incident_id": incident_id,
                "proposed_rule": proposed_rule,
            })

            return proposed_rule

        except Exception as exc:
            logger.error("Missed detection analysis failed: %s", exc)
            return {"error": str(exc)}

    async def tune_rule(self, rule_id: str, feedback: str = "too_many_false_positives") -> dict[str, Any]:
        """Tune a detection rule based on feedback."""
        tuning_suggestions: dict[str, Any] = {
            "rule_id": rule_id,
            "feedback": feedback,
            "suggestions": [],
        }

        if feedback == "too_many_false_positives":
            tuning_suggestions["suggestions"] = [
                {"action": "increase_threshold", "description": "Increase event count threshold by 50%"},
                {"action": "add_suppression", "description": "Add 10-minute cooldown between alerts"},
                {"action": "add_exclusion", "description": "Exclude known-good IPs and service accounts"},
                {"action": "increase_confidence_requirement", "description": "Require higher confidence for alert"},
            ]
        elif feedback == "too_few_detections":
            tuning_suggestions["suggestions"] = [
                {"action": "lower_threshold", "description": "Reduce event count threshold by 25%"},
                {"action": "expand_event_types", "description": "Include related event types"},
                {"action": "widen_window", "description": "Expand time window for correlation"},
            ]

        await self._log_action("tune_rule", tuning_suggestions)
        return tuning_suggestions

    async def generate_coverage_gaps(self) -> dict[str, Any]:
        """Identify MITRE ATT&CK coverage gaps."""
        # Full MITRE tactics
        all_tactics = [
            "TA0001", "TA0002", "TA0003", "TA0004", "TA0005",
            "TA0006", "TA0007", "TA0008", "TA0009", "TA0010",
            "TA0011", "TA0040", "TA0042", "TA0043",
        ]

        try:
            rules = (
                self.db.table("detection_rules")
                .select("mitre_tactics, mitre_techniques")
                .eq("enabled", True)
                .execute()
            )

            covered_tactics = set()
            for rule in (rules.data or []):
                for tactic in (rule.get("mitre_tactics") or []):
                    covered_tactics.add(tactic)

            gaps = [t for t in all_tactics if t not in covered_tactics]

            return {
                "total_tactics": len(all_tactics),
                "covered_tactics": len(covered_tactics),
                "coverage_percentage": round(len(covered_tactics) / len(all_tactics) * 100, 1),
                "gaps": gaps,
                "recommendations": [
                    f"Create detection rules for tactic {gap}" for gap in gaps[:5]
                ],
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _log_action(self, action_type: str, details: dict[str, Any]):
        """Log agent action to audit trail."""
        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": self.AGENT_NAME,
                "action_type": action_type,
                "details": details,
                "status": "completed",
            }).execute()
        except Exception:
            pass
