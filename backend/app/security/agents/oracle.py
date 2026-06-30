"""
backend/app/security/agents/oracle.py — Oracle Agent

Threat intelligence agent responsible for:
- Importing and managing threat feeds (IPs, domains, hashes, CVEs)
- Enriching events with threat context
- Correlating local events with global threat landscape
- Maintaining IOC database freshness
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class OracleAgent(BaseSecurityAgent):
    agent_id = "oracle"
    name = "Oracle"
    description = "Threat intelligence — imports known bad IPs, CVEs, exploit feeds, malware hashes."
    capabilities = ["threat_intel", "ioc_import", "cve_tracking", "feed_management"]

    # IP enrichment fields
    ENRICHMENT_FIELDS = [
        "asn", "organization", "country", "is_vpn", "is_tor",
        "is_proxy", "abuse_score", "reverse_dns", "whois_data",
    ]

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Enrich alert context with threat intelligence.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        ip = alert.get("ip")
        actor = alert.get("actor")

        # Enrich IP with threat intelligence
        if ip:
            ip_intel = await self._enrich_ip(ip)
            if ip_intel:
                findings.append(ip_intel)

        # Check threat feeds for matches
        feed_matches = await self._check_threat_feeds(ip, actor)
        if feed_matches:
            findings.append(feed_matches)

        # Get relevant CVEs for the context
        cve_context = await self._get_relevant_cves(alert)
        if cve_context:
            findings.append(cve_context)

        return findings

    async def _enrich_ip(self, ip: str) -> dict[str, Any] | None:
        """Enrich an IP address with available intelligence."""
        try:
            # Check existing IP history
            history_resp = (
                self.db.table("security_ip_history")
                .select("*")
                .eq("ip", ip)
                .limit(1)
                .execute()
            )
            existing = history_resp.data[0] if history_resp.data else None

            if existing:
                risk_indicators = []
                if existing.get("is_vpn"):
                    risk_indicators.append("VPN detected")
                if existing.get("is_tor"):
                    risk_indicators.append("Tor exit node")
                if existing.get("is_proxy"):
                    risk_indicators.append("Known proxy")
                if (existing.get("abuse_score") or 0) > 50:
                    risk_indicators.append(f"High abuse score: {existing['abuse_score']}")

                return {
                    "type": "ip_enrichment",
                    "ip": ip,
                    "asn": existing.get("asn"),
                    "organization": existing.get("organization"),
                    "country": existing.get("country"),
                    "is_vpn": existing.get("is_vpn", False),
                    "is_tor": existing.get("is_tor", False),
                    "abuse_score": existing.get("abuse_score", 0),
                    "risk_indicators": risk_indicators,
                    "risk_level": "high" if len(risk_indicators) >= 2 else "medium" if risk_indicators else "low",
                    "historical_events": existing.get("event_count", 0),
                }
            else:
                # Create new IP history entry (stub — would call external APIs in production)
                self.db.table("security_ip_history").insert({
                    "ip": ip,
                    "first_seen": datetime.now(timezone.utc).isoformat(),
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "event_count": 1,
                }).execute()

                return {
                    "type": "ip_enrichment",
                    "ip": ip,
                    "status": "new_ip",
                    "risk_level": "unknown",
                    "description": "First time seeing this IP — no historical data available.",
                }
        except Exception:
            pass

        return None

    async def _check_threat_feeds(self, ip: str | None, actor: str | None) -> dict[str, Any] | None:
        """Check if IP or actor appears in any threat feed."""
        matches: list[dict[str, Any]] = []

        try:
            if ip:
                ioc_resp = (
                    self.db.table("security_iocs")
                    .select("*")
                    .eq("value", ip)
                    .execute()
                )
                for ioc in (ioc_resp.data or []):
                    matches.append({
                        "ioc_type": ioc.get("ioc_type"),
                        "value": ioc.get("value"),
                        "severity": ioc.get("severity"),
                        "confidence": ioc.get("confidence"),
                        "tags": ioc.get("tags", []),
                    })

            if actor:
                actor_resp = (
                    self.db.table("security_iocs")
                    .select("*")
                    .eq("ioc_type", "email")
                    .eq("value", actor)
                    .execute()
                )
                for ioc in (actor_resp.data or []):
                    matches.append({
                        "ioc_type": "email",
                        "value": actor,
                        "severity": ioc.get("severity"),
                        "confidence": ioc.get("confidence"),
                    })

            if matches:
                return {
                    "type": "threat_feed_match",
                    "matches": matches,
                    "match_count": len(matches),
                    "risk_level": "critical" if any(m.get("severity") == "critical" for m in matches) else "high",
                    "description": f"Found {len(matches)} threat feed match(es)",
                }
        except Exception:
            pass

        return None

    async def _get_relevant_cves(self, alert: dict[str, Any]) -> dict[str, Any] | None:
        """
        Get relevant CVEs based on alert context.
        Stub — in production would query NVD/MITRE APIs.
        """
        # Placeholder: return None until CVE feed integration is implemented
        return None

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Update threat intelligence records."""
        actions: list[dict[str, Any]] = []

        for finding in findings:
            if finding.get("type") == "ip_enrichment" and finding.get("ip"):
                # Update IP last_seen
                try:
                    self.db.table("security_ip_history").update({
                        "last_seen": datetime.now(timezone.utc).isoformat(),
                    }).eq("ip", finding["ip"]).execute()
                    actions.append({"action": "update_ip_history", "status": "success"})
                except Exception:
                    pass

            if finding.get("type") == "threat_feed_match":
                actions.append({
                    "action": "threat_feed_alert",
                    "matches": finding.get("match_count", 0),
                    "status": "flagged",
                })

        return actions

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Oracle threat intelligence report."""
        threat_matches = [f for f in findings if f.get("type") == "threat_feed_match"]
        high_risk_ips = [f for f in findings if f.get("risk_level") in ("high", "critical")]

        recommendations = []
        if threat_matches:
            recommendations.append("ALERT: Threat feed matches detected — immediate investigation required.")
        if high_risk_ips:
            recommendations.append("High-risk IP detected — consider blocking at WAF/firewall level.")

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="completed",
            findings=findings,
            actions_taken=actions,
            recommendations=recommendations or ["No threat intelligence matches found."],
            confidence=80 if findings else 90,
            metadata={
                "threat_matches": len(threat_matches),
                "enriched_ips": len([f for f in findings if f.get("type") == "ip_enrichment"]),
            },
        )
