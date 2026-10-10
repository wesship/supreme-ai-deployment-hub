"""
Threat Hunter V2 Agent — Proactive hypothesis-driven threat hunting.

Responsibilities:
- Generate hunting hypotheses based on threat intelligence
- Execute structured hunts against event data
- Identify previously undetected threats
- Document findings and create detection rules
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("d3vonn.agents.threat_hunter_v2")


class ThreatHunterV2Agent:
    """Proactive threat hunting agent with hypothesis-driven methodology."""

    AGENT_ID = "threat_hunter_v2"
    AGENT_NAME = "Threat Hunter"
    CAPABILITIES = [
        "hypothesis_generation",
        "hunt_execution",
        "ioc_sweep",
        "behavioral_analysis",
        "persistence_detection",
    ]

    def __init__(self, supabase_client: Any, llm_client: Any = None):
        self.db = supabase_client
        self.llm = llm_client

    async def generate_hypotheses(self, context: str = "general") -> list[dict[str, Any]]:
        """Generate hunting hypotheses based on current threat landscape."""
        hypotheses = [
            {
                "id": "H001",
                "hypothesis": "Compromised credentials are being used from unusual locations",
                "data_sources": ["security_events", "auth_logs"],
                "indicators": ["impossible_travel", "new_device", "off_hours_access"],
                "mitre_technique": "T1078",
                "priority": "high",
            },
            {
                "id": "H002",
                "hypothesis": "An insider is exfiltrating data through API bulk exports",
                "data_sources": ["security_events", "api_logs"],
                "indicators": ["large_exports", "off_hours", "new_destinations"],
                "mitre_technique": "T1567",
                "priority": "high",
            },
            {
                "id": "H003",
                "hypothesis": "Persistence mechanisms have been established via API keys",
                "data_sources": ["security_events", "api_key_audit"],
                "indicators": ["long_lived_keys", "unused_scopes", "no_expiry"],
                "mitre_technique": "T1098",
                "priority": "medium",
            },
            {
                "id": "H004",
                "hypothesis": "Lateral movement is occurring between services",
                "data_sources": ["security_events", "service_access_logs"],
                "indicators": ["first_time_access", "rapid_service_traversal"],
                "mitre_technique": "T1021",
                "priority": "medium",
            },
            {
                "id": "H005",
                "hypothesis": "Supply chain compromise via malicious dependency",
                "data_sources": ["deploy_logs", "network_events"],
                "indicators": ["new_outbound_connections", "critical_cves", "unknown_packages"],
                "mitre_technique": "T1195.002",
                "priority": "high",
            },
        ]
        return hypotheses

    async def execute_hunt(self, hypothesis_id: str) -> dict[str, Any]:
        """Execute a structured hunt based on a hypothesis."""
        hunts = {
            "H001": self._hunt_compromised_credentials,
            "H002": self._hunt_data_exfiltration,
            "H003": self._hunt_persistence_mechanisms,
            "H004": self._hunt_lateral_movement,
            "H005": self._hunt_supply_chain,
        }

        hunt_fn = hunts.get(hypothesis_id)
        if not hunt_fn:
            return {"error": f"Unknown hypothesis: {hypothesis_id}"}

        result = await hunt_fn()
        await self._log_action("execute_hunt", {"hypothesis_id": hypothesis_id, "result": result})
        return result

    async def _hunt_compromised_credentials(self) -> dict[str, Any]:
        """Hunt for compromised credential usage."""
        window = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        try:
            events = (
                self.db.table("security_events")
                .select("actor, ip, metadata, created_at")
                .eq("event_type", "auth.login_success")
                .gte("created_at", window)
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )

            # Analyze for anomalies
            actor_ips: dict[str, set] = {}
            for event in (events.data or []):
                actor = event.get("actor", "")
                ip = event.get("ip", "")
                if actor and ip:
                    if actor not in actor_ips:
                        actor_ips[actor] = set()
                    actor_ips[actor].add(ip)

            suspicious = [
                {"actor": actor, "unique_ips": len(ips), "ips": list(ips)[:5]}
                for actor, ips in actor_ips.items()
                if len(ips) > 3
            ]

            return {
                "hypothesis": "H001",
                "findings": suspicious,
                "total_actors_analyzed": len(actor_ips),
                "suspicious_count": len(suspicious),
                "verdict": "findings_present" if suspicious else "no_findings",
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _hunt_data_exfiltration(self) -> dict[str, Any]:
        """Hunt for data exfiltration patterns."""
        window = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        try:
            events = (
                self.db.table("security_events")
                .select("actor, metadata, created_at")
                .in_("event_type", ["data.bulk_export", "data.external_transfer", "admin.bulk_user_export"])
                .gte("created_at", window)
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            )

            return {
                "hypothesis": "H002",
                "findings": events.data or [],
                "export_count": len(events.data or []),
                "verdict": "findings_present" if events.data else "no_findings",
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _hunt_persistence_mechanisms(self) -> dict[str, Any]:
        """Hunt for unauthorized persistence mechanisms."""
        try:
            events = (
                self.db.table("security_events")
                .select("actor, metadata, created_at")
                .in_("event_type", ["admin.api_key_created", "auth.service_account_created"])
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )

            suspicious = []
            for event in (events.data or []):
                meta = event.get("metadata", {})
                if meta.get("expiry") == "never" or meta.get("key_scope") == "full_access":
                    suspicious.append(event)

            return {
                "hypothesis": "H003",
                "findings": suspicious,
                "verdict": "findings_present" if suspicious else "no_findings",
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _hunt_lateral_movement(self) -> dict[str, Any]:
        """Hunt for lateral movement patterns."""
        window = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        try:
            events = (
                self.db.table("security_events")
                .select("actor, metadata, created_at")
                .eq("event_type", "api.access")
                .gte("created_at", window)
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )

            actor_services: dict[str, list] = {}
            for event in (events.data or []):
                actor = event.get("actor", "")
                meta = event.get("metadata", {})
                service = meta.get("service", "")
                if actor and service and meta.get("first_access"):
                    if actor not in actor_services:
                        actor_services[actor] = []
                    actor_services[actor].append(service)

            suspicious = [
                {"actor": actor, "new_services": services}
                for actor, services in actor_services.items()
                if len(services) >= 3
            ]

            return {
                "hypothesis": "H004",
                "findings": suspicious,
                "verdict": "findings_present" if suspicious else "no_findings",
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _hunt_supply_chain(self) -> dict[str, Any]:
        """Hunt for supply chain compromise indicators."""
        try:
            events = (
                self.db.table("security_events")
                .select("*")
                .in_("event_type", ["dependency.vulnerability_detected", "deploy.package_installed", "network.outbound_connection"])
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            )

            critical_vulns = [
                e for e in (events.data or [])
                if e.get("severity") == "critical" or (e.get("metadata", {}).get("severity") == "critical")
            ]

            return {
                "hypothesis": "H005",
                "findings": critical_vulns,
                "verdict": "findings_present" if critical_vulns else "no_findings",
            }
        except Exception as exc:
            return {"error": str(exc)}

    async def _log_action(self, action_type: str, details: dict[str, Any]):
        try:
            self.db.table("hermes_security_actions").insert({
                "agent_name": self.AGENT_NAME,
                "action_type": action_type,
                "details": details,
                "status": "completed",
            }).execute()
        except Exception:
            pass
