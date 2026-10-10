"""
backend/app/security/agents/hunter.py — Hunter Agent

Threat hunting agent responsible for:
- Searching for persistence mechanisms
- Detecting lateral movement patterns
- Identifying ransomware indicators
- Detecting C2 beaconing patterns
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class HunterAgent(BaseSecurityAgent):
    agent_id = "hunter"
    name = "Hunter"
    description = "Threat hunting — searches for persistence, lateral movement, ransomware indicators, beaconing."
    capabilities = ["threat_hunting", "persistence_detection", "lateral_movement", "ransomware_detection", "beaconing"]

    # MITRE ATT&CK technique patterns this agent looks for
    HUNT_PATTERNS: dict[str, dict[str, Any]] = {
        "persistence": {
            "mitre_tactic": "TA0003",
            "techniques": ["T1078", "T1136", "T1098"],  # Valid Accounts, Create Account, Account Manipulation
            "event_types": ["auth.role_changed", "auth.account_created", "system.config_change"],
        },
        "lateral_movement": {
            "mitre_tactic": "TA0008",
            "techniques": ["T1021", "T1550"],  # Remote Services, Use Alternate Auth Material
            "indicators": ["multiple_services_same_actor", "token_reuse_different_ip"],
        },
        "ransomware": {
            "mitre_tactic": "TA0040",
            "techniques": ["T1486", "T1490"],  # Data Encrypted for Impact, Inhibit System Recovery
            "indicators": ["mass_file_encryption", "backup_deletion", "shadow_copy_deletion"],
        },
        "beaconing": {
            "mitre_tactic": "TA0011",
            "techniques": ["T1071", "T1573"],  # Application Layer Protocol, Encrypted Channel
            "indicators": ["regular_interval_connections", "encoded_payloads", "dns_tunneling"],
        },
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Conduct threat hunting based on alert context.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        actor = alert.get("actor")
        ip = alert.get("ip")

        # Hunt for persistence
        persistence = await self._hunt_persistence(actor)
        if persistence:
            findings.append(persistence)

        # Hunt for lateral movement
        lateral = await self._hunt_lateral_movement(actor, ip)
        if lateral:
            findings.append(lateral)

        # Check IOC matches
        ioc_matches = await self._check_iocs(ip, actor)
        if ioc_matches:
            findings.append(ioc_matches)

        return findings

    async def _hunt_persistence(self, actor: str | None) -> dict[str, Any] | None:
        """Look for persistence indicators."""
        if not actor:
            return None

        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=72)
            ).isoformat()

            # Check for account manipulation events
            events_resp = (
                self.db.table("security_events")
                .select("*")
                .eq("actor", actor)
                .in_("event_type", ["auth.role_changed", "system.config_change"])
                .gte("created_at", window_start)
                .execute()
            )
            events = events_resp.data or []

            if len(events) >= 2:
                return {
                    "type": "persistence_indicator",
                    "mitre_tactic": "TA0003",
                    "mitre_techniques": ["T1098"],
                    "actor": actor,
                    "event_count": len(events),
                    "risk_level": "high",
                    "description": f"Multiple account/config changes by {actor} — possible persistence establishment",
                    "evidence": events[:5],
                }
        except Exception:
            pass

        return None

    async def _hunt_lateral_movement(self, actor: str | None, ip: str | None) -> dict[str, Any] | None:
        """Look for lateral movement patterns."""
        if not actor:
            return None

        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=24)
            ).isoformat()

            # Check for same actor accessing multiple services from different IPs
            events_resp = (
                self.db.table("security_events")
                .select("ip, source, event_type")
                .eq("actor", actor)
                .gte("created_at", window_start)
                .limit(200)
                .execute()
            )
            events = events_resp.data or []

            unique_ips = set(str(e.get("ip", "")) for e in events if e.get("ip"))
            unique_sources = set(e.get("source", "") for e in events if e.get("source"))

            if len(unique_ips) > 3 and len(unique_sources) > 2:
                return {
                    "type": "lateral_movement_indicator",
                    "mitre_tactic": "TA0008",
                    "mitre_techniques": ["T1021"],
                    "actor": actor,
                    "unique_ips": list(unique_ips),
                    "unique_services": list(unique_sources),
                    "risk_level": "high",
                    "description": f"Actor {actor} accessing {len(unique_sources)} services from {len(unique_ips)} IPs",
                }
        except Exception:
            pass

        return None

    async def _check_iocs(self, ip: str | None, actor: str | None) -> dict[str, Any] | None:
        """Check if IP or actor matches known IOCs."""
        if not ip:
            return None

        try:
            ioc_resp = (
                self.db.table("security_iocs")
                .select("*")
                .eq("ioc_type", "ip")
                .eq("value", ip)
                .limit(5)
                .execute()
            )
            matches = ioc_resp.data or []

            if matches:
                return {
                    "type": "ioc_match",
                    "mitre_tactic": "TA0001",
                    "ip": ip,
                    "matches": matches,
                    "risk_level": "critical",
                    "description": f"IP {ip} matches {len(matches)} known IOC(s)",
                }
        except Exception:
            pass

        return None

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Record hunting results and update knowledge graph."""
        actions: list[dict[str, Any]] = []

        for finding in findings:
            # Record attack chain if MITRE techniques found
            if finding.get("mitre_techniques"):
                try:
                    self.db.table("security_attack_chains").insert({
                        "name": f"Hunt finding: {finding.get('type')}",
                        "description": finding.get("description"),
                        "mitre_tactics": [finding.get("mitre_tactic", "")],
                        "mitre_techniques": finding.get("mitre_techniques", []),
                        "confidence": 60,
                    }).execute()
                    actions.append({"action": "record_attack_chain", "status": "success"})
                except Exception as exc:
                    actions.append({"action": "record_attack_chain", "status": "failed", "error": str(exc)})

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Hunter threat hunting report."""
        critical = [f for f in findings if f.get("risk_level") == "critical"]
        techniques = []
        for f in findings:
            techniques.extend(f.get("mitre_techniques", []))

        recommendations = []
        if any(f.get("type") == "persistence_indicator" for f in findings):
            recommendations.append("Investigate account changes for unauthorized persistence mechanisms.")
        if any(f.get("type") == "lateral_movement_indicator" for f in findings):
            recommendations.append("Isolate affected systems and review network segmentation.")
        if any(f.get("type") == "ioc_match" for f in findings):
            recommendations.append("CRITICAL: Block matched IOC immediately and investigate all associated activity.")

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="escalated" if critical else "completed",
            findings=findings,
            actions_taken=actions,
            recommendations=recommendations or ["No active threats detected during hunt."],
            confidence=65 if findings else 85,
            metadata={
                "mitre_techniques": list(set(techniques)),
                "critical_findings": len(critical),
            },
        )
