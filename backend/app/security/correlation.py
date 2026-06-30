"""
backend/app/security/correlation.py — Event Correlation Engine

Correlates security events to identify:
- Temporal correlations (events happening in sequence)
- Actor correlations (same actor across multiple event types)
- IP correlations (same IP targeting multiple actors)
- Technique correlations (MITRE ATT&CK campaign detection)
- Campaign detection (coordinated attacks)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.correlation")


class CorrelationEngine:
    """
    Correlates security events to detect multi-stage attacks and campaigns.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def correlate_alert(self, alert: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Run all correlation checks for a new alert.
        Returns list of correlation findings.
        """
        correlations: list[dict[str, Any]] = []

        # Temporal correlation
        temporal = await self._temporal_correlation(alert)
        if temporal:
            correlations.append(temporal)

        # Actor correlation
        actor_corr = await self._actor_correlation(alert)
        if actor_corr:
            correlations.append(actor_corr)

        # IP correlation
        ip_corr = await self._ip_correlation(alert)
        if ip_corr:
            correlations.append(ip_corr)

        # Store correlations
        for corr in correlations:
            await self._store_correlation(corr)

        return correlations

    async def _temporal_correlation(self, alert: dict[str, Any]) -> Optional[dict[str, Any]]:
        """
        Find events that happened in close temporal proximity to this alert.
        Looks for attack sequences (e.g., recon → exploit → persistence).
        """
        actor = alert.get("actor")
        if not actor:
            return None

        try:
            # Look for events within 10 minutes of this alert
            window_start = (
                datetime.now(timezone.utc) - timedelta(minutes=10)
            ).isoformat()

            resp = (
                self.db.table("security_events")
                .select("id, event_type, severity, ip, created_at")
                .eq("actor", actor)
                .gte("created_at", window_start)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            events = resp.data or []

            if len(events) < 3:
                return None

            # Check for attack sequence patterns
            event_types = [e.get("event_type", "") for e in events]
            sequence = self._detect_attack_sequence(event_types)

            if sequence:
                return {
                    "correlation_type": "temporal",
                    "event_ids": [e.get("id") for e in events if e.get("id")],
                    "confidence": sequence["confidence"],
                    "description": sequence["description"],
                    "metadata": {
                        "actor": actor,
                        "event_types": event_types,
                        "window_minutes": 10,
                        "pattern": sequence["pattern"],
                    },
                }
        except Exception as exc:
            logger.warning("Temporal correlation failed: %s", exc)

        return None

    def _detect_attack_sequence(self, event_types: list[str]) -> Optional[dict[str, Any]]:
        """Detect known attack sequences in event type lists."""
        # Known attack patterns
        patterns = [
            {
                "name": "credential_stuffing_to_access",
                "sequence": ["login_failed", "login_failed", "login_success"],
                "description": "Multiple failed logins followed by success — possible credential stuffing",
                "confidence": 70,
            },
            {
                "name": "recon_to_escalation",
                "sequence": ["api.unauthorized", "auth.login_success", "auth.role_changed"],
                "description": "Unauthorized API access → login → privilege escalation",
                "confidence": 85,
            },
            {
                "name": "token_theft_chain",
                "sequence": ["auth.token_reuse", "auth.login_success", "auth.mfa_disabled"],
                "description": "Token reuse → login → MFA disabled — account takeover in progress",
                "confidence": 90,
            },
        ]

        for pattern in patterns:
            if self._sequence_matches(event_types, pattern["sequence"]):
                return {
                    "pattern": pattern["name"],
                    "description": pattern["description"],
                    "confidence": pattern["confidence"],
                }

        return None

    @staticmethod
    def _sequence_matches(events: list[str], pattern: list[str]) -> bool:
        """Check if a pattern exists as a subsequence in events."""
        pattern_idx = 0
        for event in events:
            if pattern_idx >= len(pattern):
                break
            if pattern[pattern_idx] in event:
                pattern_idx += 1
        return pattern_idx >= len(pattern)

    async def _actor_correlation(self, alert: dict[str, Any]) -> Optional[dict[str, Any]]:
        """
        Find if the same actor is triggering multiple different alert types.
        Indicates a multi-stage attack.
        """
        actor = alert.get("actor")
        if not actor:
            return None

        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=1)
            ).isoformat()

            resp = (
                self.db.table("security_alerts")
                .select("id, rule_id, severity")
                .eq("actor", actor)
                .gte("created_at", window_start)
                .execute()
            )
            alerts = resp.data or []

            if len(alerts) < 2:
                return None

            unique_rules = set(a.get("rule_id", "") for a in alerts)
            if len(unique_rules) >= 2:
                return {
                    "correlation_type": "actor",
                    "alert_ids": [a.get("id") for a in alerts if a.get("id")],
                    "confidence": min(50 + len(unique_rules) * 15, 95),
                    "description": f"Actor '{actor}' triggered {len(unique_rules)} different alert types in 1h",
                    "metadata": {
                        "actor": actor,
                        "unique_rules": list(unique_rules),
                        "alert_count": len(alerts),
                    },
                }
        except Exception as exc:
            logger.warning("Actor correlation failed: %s", exc)

        return None

    async def _ip_correlation(self, alert: dict[str, Any]) -> Optional[dict[str, Any]]:
        """
        Find if the same IP is targeting multiple actors.
        Indicates a scanning/spray attack.
        """
        ip = alert.get("ip")
        if not ip:
            return None

        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=1)
            ).isoformat()

            resp = (
                self.db.table("security_events")
                .select("actor")
                .eq("ip", ip)
                .gte("created_at", window_start)
                .execute()
            )
            events = resp.data or []

            unique_actors = set(e.get("actor", "") for e in events if e.get("actor"))
            if len(unique_actors) >= 3:
                return {
                    "correlation_type": "ip",
                    "confidence": min(60 + len(unique_actors) * 10, 95),
                    "description": f"IP {ip} targeting {len(unique_actors)} different actors in 1h",
                    "metadata": {
                        "ip": ip,
                        "targeted_actors": list(unique_actors)[:20],
                        "actor_count": len(unique_actors),
                    },
                }
        except Exception as exc:
            logger.warning("IP correlation failed: %s", exc)

        return None

    async def _store_correlation(self, correlation: dict[str, Any]):
        """Store a correlation finding in the database."""
        try:
            self.db.table("security_correlations").insert({
                "correlation_type": correlation.get("correlation_type"),
                "event_ids": correlation.get("event_ids", []),
                "alert_ids": correlation.get("alert_ids", []),
                "confidence": correlation.get("confidence", 50),
                "description": correlation.get("description"),
                "metadata": correlation.get("metadata", {}),
            }).execute()
        except Exception as exc:
            logger.warning("Failed to store correlation: %s", exc)

    async def get_correlations(
        self,
        correlation_type: Optional[str] = None,
        min_confidence: int = 50,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Retrieve stored correlations."""
        try:
            query = (
                self.db.table("security_correlations")
                .select("*")
                .gte("confidence", min_confidence)
                .order("created_at", desc=True)
                .limit(limit)
            )
            if correlation_type:
                query = query.eq("correlation_type", correlation_type)

            resp = query.execute()
            return resp.data or []
        except Exception:
            return []
