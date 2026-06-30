"""
backend/app/security/agents/analyst.py — Analyst Agent

Investigation and reporting agent responsible for:
- Writing executive summaries for incidents
- Constructing attack timelines
- Mapping findings to MITRE ATT&CK framework
- Generating actionable recommendations
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class AnalystAgent(BaseSecurityAgent):
    agent_id = "analyst"
    name = "Analyst"
    description = "Investigation & reporting — writes executive summaries, timelines, MITRE mappings, recommendations."
    capabilities = ["report_generation", "timeline_construction", "mitre_mapping", "executive_summary"]

    # MITRE ATT&CK tactic mapping
    MITRE_TACTICS: dict[str, str] = {
        "TA0001": "Initial Access",
        "TA0002": "Execution",
        "TA0003": "Persistence",
        "TA0004": "Privilege Escalation",
        "TA0005": "Defense Evasion",
        "TA0006": "Credential Access",
        "TA0007": "Discovery",
        "TA0008": "Lateral Movement",
        "TA0009": "Collection",
        "TA0010": "Exfiltration",
        "TA0011": "Command and Control",
        "TA0040": "Impact",
    }

    # Common technique descriptions
    MITRE_TECHNIQUES: dict[str, str] = {
        "T1078": "Valid Accounts",
        "T1110": "Brute Force",
        "T1136": "Create Account",
        "T1098": "Account Manipulation",
        "T1021": "Remote Services",
        "T1550": "Use Alternate Authentication Material",
        "T1486": "Data Encrypted for Impact",
        "T1071": "Application Layer Protocol",
        "T1573": "Encrypted Channel",
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Build investigation context: timeline, MITRE mapping, and impact assessment.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        actor = alert.get("actor")
        rule_id = alert.get("rule_id", "")

        # Build event timeline
        timeline = await self._build_timeline(actor, rule_id)
        if timeline:
            findings.append(timeline)

        # Map to MITRE ATT&CK
        mitre_mapping = self._map_to_mitre(rule_id, alert)
        if mitre_mapping:
            findings.append(mitre_mapping)

        # Assess impact
        impact = await self._assess_impact(alert, timeline)
        if impact:
            findings.append(impact)

        return findings

    async def _build_timeline(self, actor: str | None, rule_id: str) -> dict[str, Any] | None:
        """Construct a chronological timeline of related events."""
        if not actor:
            return None

        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=24)
            ).isoformat()

            events_resp = (
                self.db.table("security_events")
                .select("id, created_at, event_type, severity, ip, outcome, source")
                .eq("actor", actor)
                .gte("created_at", window_start)
                .order("created_at", desc=False)
                .limit(50)
                .execute()
            )
            events = events_resp.data or []

            if not events:
                return None

            timeline_entries = []
            for ev in events:
                timeline_entries.append({
                    "timestamp": ev.get("created_at"),
                    "event_type": ev.get("event_type"),
                    "severity": ev.get("severity"),
                    "source": ev.get("source"),
                    "ip": str(ev.get("ip", "")),
                    "outcome": ev.get("outcome"),
                })

            return {
                "type": "timeline",
                "actor": actor,
                "event_count": len(events),
                "time_span_hours": 24,
                "entries": timeline_entries,
                "first_event": timeline_entries[0]["timestamp"] if timeline_entries else None,
                "last_event": timeline_entries[-1]["timestamp"] if timeline_entries else None,
            }
        except Exception:
            pass

        return None

    def _map_to_mitre(self, rule_id: str, alert: dict[str, Any]) -> dict[str, Any] | None:
        """Map the alert to MITRE ATT&CK tactics and techniques."""
        mapping: dict[str, list[str]] = {
            "brute_force_login": ["TA0006"],  # Credential Access
            "api_abuse": ["TA0040"],           # Impact
            "admin_privilege_escalation": ["TA0004"],  # Privilege Escalation
            "token_reuse": ["TA0006", "TA0005"],  # Credential Access + Defense Evasion
        }

        technique_mapping: dict[str, list[str]] = {
            "brute_force_login": ["T1110"],
            "admin_privilege_escalation": ["T1098", "T1078"],
            "token_reuse": ["T1550"],
        }

        tactics = mapping.get(rule_id, [])
        techniques = technique_mapping.get(rule_id, [])

        if not tactics:
            return None

        return {
            "type": "mitre_mapping",
            "rule_id": rule_id,
            "tactics": [{"id": t, "name": self.MITRE_TACTICS.get(t, t)} for t in tactics],
            "techniques": [{"id": t, "name": self.MITRE_TECHNIQUES.get(t, t)} for t in techniques],
            "kill_chain_phase": self._determine_kill_chain_phase(tactics),
        }

    def _determine_kill_chain_phase(self, tactics: list[str]) -> str:
        """Determine the kill chain phase from MITRE tactics."""
        phase_map = {
            "TA0001": "delivery",
            "TA0002": "exploitation",
            "TA0003": "installation",
            "TA0004": "exploitation",
            "TA0005": "exploitation",
            "TA0006": "exploitation",
            "TA0008": "actions",
            "TA0010": "actions",
            "TA0011": "c2",
            "TA0040": "actions",
        }
        for tactic in tactics:
            if tactic in phase_map:
                return phase_map[tactic]
        return "unknown"

    async def _assess_impact(self, alert: dict[str, Any], timeline: dict[str, Any] | None) -> dict[str, Any] | None:
        """Assess the potential business impact."""
        severity = alert.get("severity", "medium")
        event_count = timeline.get("event_count", 0) if timeline else 0

        impact_level = "low"
        if severity == "critical":
            impact_level = "critical"
        elif severity == "high" and event_count > 10:
            impact_level = "high"
        elif severity == "high":
            impact_level = "medium"

        return {
            "type": "impact_assessment",
            "impact_level": impact_level,
            "severity": severity,
            "event_volume": event_count,
            "affected_actor": alert.get("actor"),
            "business_impact": self._describe_business_impact(alert.get("rule_id", ""), impact_level),
        }

    def _describe_business_impact(self, rule_id: str, impact_level: str) -> str:
        """Generate business impact description."""
        descriptions = {
            "brute_force_login": "Potential unauthorized access to user accounts. Risk of data breach.",
            "api_abuse": "Service degradation or denial of service. Potential cost impact from excessive API usage.",
            "admin_privilege_escalation": "Unauthorized administrative access. Full system compromise possible.",
            "token_reuse": "Session hijacking risk. Attacker may have active access to compromised account.",
        }
        return descriptions.get(rule_id, f"Security incident with {impact_level} business impact.")

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Generate and store investigation report."""
        actions: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})

        # Generate report content
        report_md = self._generate_report_markdown(alert, findings)

        try:
            self.db.table("security_reports").insert({
                "report_type": "investigation",
                "title": f"Investigation: {alert.get('rule_id', 'Unknown')} — {alert.get('actor', 'Unknown')}",
                "content_md": report_md,
                "content_json": {"findings": findings},
                "generated_by": "hermes-analyst",
                "mitre_mapping": next(
                    (f for f in findings if f.get("type") == "mitre_mapping"), {}
                ),
                "recommendations": self._generate_recommendations(findings),
            }).execute()
            actions.append({"action": "generate_report", "status": "success"})
        except Exception as exc:
            actions.append({"action": "generate_report", "status": "failed", "error": str(exc)})

        return actions

    def _generate_report_markdown(self, alert: dict[str, Any], findings: list[dict[str, Any]]) -> str:
        """Generate a Markdown investigation report."""
        lines = [
            f"# Security Investigation Report",
            f"",
            f"**Alert:** {alert.get('rule_id', 'Unknown')}",
            f"**Actor:** {alert.get('actor', 'Unknown')}",
            f"**Severity:** {alert.get('severity', 'Unknown')}",
            f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            f"",
            f"## Executive Summary",
            f"",
        ]

        impact = next((f for f in findings if f.get("type") == "impact_assessment"), None)
        if impact:
            lines.append(f"**Impact Level:** {impact.get('impact_level', 'Unknown')}")
            lines.append(f"**Business Impact:** {impact.get('business_impact', 'Under assessment')}")
            lines.append("")

        # Timeline section
        timeline = next((f for f in findings if f.get("type") == "timeline"), None)
        if timeline:
            lines.append("## Event Timeline")
            lines.append("")
            lines.append(f"Total events in window: {timeline.get('event_count', 0)}")
            lines.append("")
            for entry in (timeline.get("entries", []))[:10]:
                lines.append(f"- `{entry.get('timestamp')}` — {entry.get('event_type')} [{entry.get('severity')}] from {entry.get('ip', 'N/A')}")
            lines.append("")

        # MITRE section
        mitre = next((f for f in findings if f.get("type") == "mitre_mapping"), None)
        if mitre:
            lines.append("## MITRE ATT&CK Mapping")
            lines.append("")
            for tactic in mitre.get("tactics", []):
                lines.append(f"- **Tactic:** {tactic.get('id')} — {tactic.get('name')}")
            for technique in mitre.get("techniques", []):
                lines.append(f"- **Technique:** {technique.get('id')} — {technique.get('name')}")
            lines.append("")

        # Recommendations
        lines.append("## Recommendations")
        lines.append("")
        for rec in self._generate_recommendations(findings):
            lines.append(f"1. {rec}")

        return "\n".join(lines)

    def _generate_recommendations(self, findings: list[dict[str, Any]]) -> list[str]:
        """Generate actionable recommendations."""
        recs = []
        impact = next((f for f in findings if f.get("type") == "impact_assessment"), None)

        if impact and impact.get("impact_level") in ("high", "critical"):
            recs.append("Immediately contain the threat — consider blocking the actor/IP.")
            recs.append("Notify the security team and initiate incident response procedures.")

        mitre = next((f for f in findings if f.get("type") == "mitre_mapping"), None)
        if mitre:
            recs.append("Review MITRE ATT&CK mapping for detection coverage gaps.")

        timeline = next((f for f in findings if f.get("type") == "timeline"), None)
        if timeline and timeline.get("event_count", 0) > 20:
            recs.append("High event volume detected — review rate limiting and access controls.")

        if not recs:
            recs.append("Continue monitoring. No immediate action required.")

        return recs

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Analyst result."""
        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=self._generate_recommendations(findings),
            confidence=75,
            metadata={
                "report_generated": any(a.get("action") == "generate_report" and a.get("status") == "success" for a in actions),
                "mitre_mapped": any(f.get("type") == "mitre_mapping" for f in findings),
            },
        )
