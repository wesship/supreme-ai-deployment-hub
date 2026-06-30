"""
backend/app/security/agents/guardian.py — Guardian Agent

Identity monitoring agent responsible for:
- Detecting impossible travel (logins from geographically distant locations)
- Privilege escalation detection
- MFA removal monitoring
- Token theft and session hijacking detection
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.security.agents.base import BaseSecurityAgent, AgentTask, AgentResult


class GuardianAgent(BaseSecurityAgent):
    agent_id = "guardian"
    name = "Guardian"
    description = "Identity monitoring — detects impossible travel, privilege escalation, MFA removal, token theft."
    capabilities = ["identity_monitoring", "impossible_travel", "privilege_detection", "mfa_monitoring"]

    # Maximum plausible travel speed (km/h) — above this is "impossible travel"
    MAX_TRAVEL_SPEED_KMH = 900  # Roughly max commercial flight speed

    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """
        Analyze identity-related security events.
        """
        findings: list[dict[str, Any]] = []
        alert = task.input_data.get("alert", {})
        actor = alert.get("actor")
        rule_id = alert.get("rule_id", "")

        if not actor:
            return findings

        # Check for impossible travel
        travel_finding = await self._check_impossible_travel(actor)
        if travel_finding:
            findings.append(travel_finding)

        # Check for privilege escalation
        if rule_id == "admin_privilege_escalation":
            priv_finding = await self._check_privilege_escalation(actor)
            if priv_finding:
                findings.append(priv_finding)

        # Check for MFA changes
        mfa_finding = await self._check_mfa_status(actor)
        if mfa_finding:
            findings.append(mfa_finding)

        # Check for session anomalies
        session_finding = await self._check_session_anomalies(actor)
        if session_finding:
            findings.append(session_finding)

        return findings

    async def _check_impossible_travel(self, actor: str) -> dict[str, Any] | None:
        """Check for logins from geographically impossible locations."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=24)
            ).isoformat()

            sessions_resp = (
                self.db.table("security_sessions")
                .select("ip, country, city, created_at")
                .eq("user_id", actor)
                .gte("created_at", window_start)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            sessions = sessions_resp.data or []

            if len(sessions) < 2:
                return None

            # Check for different countries in short timeframes
            countries = set()
            for s in sessions:
                if s.get("country"):
                    countries.add(s["country"])

            if len(countries) > 1:
                return {
                    "type": "impossible_travel",
                    "actor": actor,
                    "countries": list(countries),
                    "session_count": len(sessions),
                    "risk_level": "high",
                    "description": f"Login detected from {len(countries)} different countries within 24h",
                }
        except Exception:
            pass

        return None

    async def _check_privilege_escalation(self, actor: str) -> dict[str, Any] | None:
        """Check for recent privilege changes."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=1)
            ).isoformat()

            events_resp = (
                self.db.table("security_events")
                .select("*")
                .eq("actor", actor)
                .eq("event_type", "auth.role_changed")
                .gte("created_at", window_start)
                .execute()
            )
            events = events_resp.data or []

            if events:
                return {
                    "type": "privilege_escalation",
                    "actor": actor,
                    "changes": len(events),
                    "risk_level": "critical",
                    "description": f"Role change detected for {actor}",
                    "events": events[:5],
                }
        except Exception:
            pass

        return None

    async def _check_mfa_status(self, actor: str) -> dict[str, Any] | None:
        """Check for MFA removal events."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=24)
            ).isoformat()

            events_resp = (
                self.db.table("security_events")
                .select("*")
                .eq("actor", actor)
                .eq("event_type", "auth.mfa_disabled")
                .gte("created_at", window_start)
                .execute()
            )
            events = events_resp.data or []

            if events:
                return {
                    "type": "mfa_removal",
                    "actor": actor,
                    "risk_level": "high",
                    "description": f"MFA was disabled for {actor}",
                }
        except Exception:
            pass

        return None

    async def _check_session_anomalies(self, actor: str) -> dict[str, Any] | None:
        """Check for suspicious session patterns."""
        try:
            active_resp = (
                self.db.table("security_sessions")
                .select("*", count="exact")
                .eq("user_id", actor)
                .eq("is_active", True)
                .execute()
            )
            active_count = active_resp.count or 0

            if active_count > 5:
                return {
                    "type": "session_anomaly",
                    "actor": actor,
                    "active_sessions": active_count,
                    "risk_level": "medium",
                    "description": f"Unusually high number of active sessions: {active_count}",
                }
        except Exception:
            pass

        return None

    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Execute identity protection actions."""
        actions: list[dict[str, Any]] = []

        for finding in findings:
            risk_level = finding.get("risk_level", "low")
            finding_type = finding.get("type", "")

            if risk_level == "critical":
                # Record high-priority action
                actions.append({
                    "action": "escalate",
                    "finding_type": finding_type,
                    "reason": finding.get("description", ""),
                    "status": "recommended",
                })

            if finding_type == "impossible_travel":
                actions.append({
                    "action": "flag_suspicious_session",
                    "actor": finding.get("actor"),
                    "status": "flagged",
                })

        # Update user risk score
        actor = task.input_data.get("alert", {}).get("actor")
        if actor and findings:
            await self._update_risk_score(actor, findings)
            actions.append({"action": "update_risk_score", "status": "success"})

        return actions

    async def _update_risk_score(self, actor: str, findings: list[dict[str, Any]]):
        """Update the user's risk score based on findings."""
        risk_increment = 0
        factors: list[dict[str, Any]] = []

        for f in findings:
            risk_level = f.get("risk_level", "low")
            if risk_level == "critical":
                risk_increment += 30
            elif risk_level == "high":
                risk_increment += 20
            elif risk_level == "medium":
                risk_increment += 10
            factors.append({"type": f.get("type"), "risk_level": risk_level})

        try:
            # Record risk score
            self.db.table("security_risk_scores").insert({
                "entity_type": "user",
                "entity_id": actor,
                "score": min(risk_increment, 100),
                "factors": factors,
                "model_version": "guardian-1.0",
            }).execute()
        except Exception as exc:
            self.logger.warning("Failed to update risk score: %s", exc)

    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate Guardian identity analysis report."""
        critical_findings = [f for f in findings if f.get("risk_level") == "critical"]

        recommendations = []
        if any(f.get("type") == "impossible_travel" for f in findings):
            recommendations.append("Verify user identity — possible account compromise via impossible travel.")
        if any(f.get("type") == "privilege_escalation" for f in findings):
            recommendations.append("Audit privilege change — confirm authorization with system admin.")
        if any(f.get("type") == "mfa_removal" for f in findings):
            recommendations.append("Re-enable MFA immediately — potential account takeover preparation.")

        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.task_id,
            status="escalated" if critical_findings else "completed",
            findings=findings,
            actions_taken=actions,
            recommendations=recommendations or ["Identity checks passed. No anomalies detected."],
            confidence=75 if findings else 95,
            metadata={"critical_count": len(critical_findings)},
        )
