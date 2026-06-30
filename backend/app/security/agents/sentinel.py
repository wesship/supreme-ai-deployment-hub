"""
backend/app/security/agents/sentinel.py — Sentinel Agent

Log analysis agent responsible for:
- Ingesting and normalizing security logs
- Classifying events by type and severity
- Prioritizing events for further investigation
- Detecting anomalous patterns in log streams
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class SentinelAgent(BaseSecurityAgent):
    agent_id = "sentinel"
    name = "Sentinel"
    description = "Log analysis — ingests, classifies, normalizes, and prioritizes security logs."
    capabilities = ["log_ingestion", "classification", "normalization", "prioritization"]

    # Event type classification patterns
    CLASSIFICATION_MAP: dict[str, str] = {
        "auth.login_failed": "authentication",
        "auth.login_success": "authentication",
        "auth.role_changed": "authorization",
        "auth.token_reuse": "token_security",
        "auth.mfa_disabled": "identity",
        "api.rate_exceeded": "api_security",
        "api.unauthorized": "api_security",
        "network.suspicious_ip": "network",
        "system.config_change": "configuration",
    }

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Analyze security events — classify, normalize, and detect patterns.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        actor = alert.get("actor")
        event_type = alert.get("rule_id", "")

        # Fetch recent events for this actor
        if actor:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=1)
            ).isoformat()

            try:
                events_resp = (
                    self.db.table("security_events")
                    .select("*")
                    .eq("actor", actor)
                    .gte("created_at", window_start)
                    .order("created_at", desc=True)
                    .limit(100)
                    .execute()
                )
                events = events_resp.data or []
            except Exception:
                events = []

            # Classify events
            categories: dict[str, int] = {}
            severity_counts: dict[str, int] = {}
            unique_ips: set[str] = set()

            for ev in events:
                cat = self.CLASSIFICATION_MAP.get(ev.get("event_type", ""), "unknown")
                categories[cat] = categories.get(cat, 0) + 1
                sev = ev.get("severity", "info")
                severity_counts[sev] = severity_counts.get(sev, 0) + 1
                if ev.get("ip"):
                    unique_ips.add(str(ev["ip"]))

            findings.append({
                "type": "log_analysis",
                "actor": actor,
                "total_events_1h": len(events),
                "categories": categories,
                "severity_distribution": severity_counts,
                "unique_ips": list(unique_ips),
                "anomaly_indicators": self._detect_anomalies(events, categories),
            })

        return findings

    def _detect_anomalies(self, events: list[dict], categories: dict[str, int]) -> list[str]:
        """Simple anomaly detection based on event patterns."""
        anomalies: list[str] = []

        total = sum(categories.values())
        if total > 50:
            anomalies.append(f"High event volume: {total} events in 1 hour")

        auth_failures = categories.get("authentication", 0)
        if auth_failures > 10:
            anomalies.append(f"Excessive auth failures: {auth_failures}")

        # Check for multiple IPs (potential distributed attack)
        ips = set()
        for ev in events:
            if ev.get("ip"):
                ips.add(str(ev["ip"]))
        if len(ips) > 5:
            anomalies.append(f"Multiple source IPs detected: {len(ips)}")

        return anomalies

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Record normalized findings and flag high-priority items.
        """
        actions: list[dict[str, Any]] = []

        for finding in findings:
            anomalies = finding.get("anomaly_indicators", [])
            if anomalies:
                # Log to security_logs for correlation
                try:
                    self.db.table("security_logs").insert({
                        "log_source": "sentinel_agent",
                        "log_level": "warning",
                        "message": f"Anomalies detected for actor {finding.get('actor')}: {'; '.join(anomalies)}",
                        "structured_data": finding,
                    }).execute()
                    actions.append({"action": "log_anomaly", "status": "success"})
                except Exception as exc:
                    actions.append({"action": "log_anomaly", "status": "failed", "error": str(exc)})

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Sentinel analysis report."""
        anomaly_count = sum(
            len(f.get("anomaly_indicators", [])) for f in findings
        )

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=[
                "Review anomalous patterns in the event timeline.",
                "Consider tightening rate limits if API abuse is detected.",
            ] if anomaly_count > 0 else ["No anomalies detected. Normal operations."],
            confidence=70 if anomaly_count > 0 else 90,
            metadata={"anomaly_count": anomaly_count},
        )
