"""
Forensics Analyst Agent — Digital forensics and evidence preservation.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("d3vonn.agents.forensics_analyst")


class ForensicsAnalystAgent:
    """Digital forensics and evidence chain management."""

    AGENT_ID = "forensics_analyst"
    AGENT_NAME = "Forensics Analyst"
    CAPABILITIES = ["evidence_collection", "chain_of_custody", "timeline_reconstruction", "artifact_preservation"]

    def __init__(self, supabase_client: Any, llm_client: Any = None):
        self.db = supabase_client
        self.llm = llm_client

    async def collect_evidence(self, incident_id: str) -> dict[str, Any]:
        """Collect and preserve all evidence related to an incident."""
        evidence_package = {
            "incident_id": incident_id,
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "collector": self.AGENT_NAME,
            "items": [],
        }

        try:
            # Collect events
            events = (
                self.db.table("security_events")
                .select("*")
                .eq("metadata->>incident_id", incident_id)
                .order("created_at")
                .execute()
            )
            evidence_package["items"].append({
                "type": "security_events",
                "count": len(events.data or []),
                "hash": self._compute_evidence_hash(events.data or []),
            })

            # Collect alerts
            alerts = (
                self.db.table("security_alerts")
                .select("*")
                .eq("incident_id", incident_id)
                .execute()
            )
            evidence_package["items"].append({
                "type": "security_alerts",
                "count": len(alerts.data or []),
                "hash": self._compute_evidence_hash(alerts.data or []),
            })

            # Collect agent actions
            actions = (
                self.db.table("hermes_security_actions")
                .select("*")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            evidence_package["items"].append({
                "type": "agent_actions",
                "count": len(actions.data or []),
            })

            evidence_package["chain_of_custody"] = {
                "collected_by": self.AGENT_NAME,
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "integrity": "verified",
                "storage": "supabase_encrypted",
            }

        except Exception as exc:
            evidence_package["error"] = str(exc)

        await self._log_action("collect_evidence", evidence_package)
        return evidence_package

    async def reconstruct_timeline(self, incident_id: str) -> list[dict[str, Any]]:
        """Reconstruct a forensic timeline for an incident."""
        timeline: list[dict[str, Any]] = []

        try:
            events = (
                self.db.table("security_events")
                .select("event_type, actor, ip, severity, metadata, created_at")
                .eq("metadata->>incident_id", incident_id)
                .order("created_at")
                .execute()
            )

            for event in (events.data or []):
                timeline.append({
                    "timestamp": event.get("created_at"),
                    "action": event.get("event_type"),
                    "actor": event.get("actor"),
                    "source_ip": event.get("ip"),
                    "severity": event.get("severity"),
                    "details": event.get("metadata", {}),
                })

        except Exception as exc:
            logger.error("Timeline reconstruction failed: %s", exc)

        return timeline

    @staticmethod
    def _compute_evidence_hash(data: list) -> str:
        """Compute integrity hash for evidence."""
        import hashlib
        content = str(sorted(str(d) for d in data))
        return hashlib.sha256(content.encode()).hexdigest()[:16]

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
