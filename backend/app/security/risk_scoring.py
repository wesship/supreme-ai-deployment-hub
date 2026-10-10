"""
backend/app/security/risk_scoring.py — AI Risk Scoring Engine

Computes a live risk score (0-100) for users, IPs, assets, and sessions.
Factors include:
- Failed login frequency
- Geographic anomalies (multiple countries)
- Admin access level
- MFA status
- Token reuse indicators
- Known malicious ASN
- Historical abuse score
- Session anomalies
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.risk_scoring")


class RiskFactor:
    """A single risk factor contributing to the overall score."""

    def __init__(self, name: str, weight: float, value: float, description: str = ""):
        self.name = name
        self.weight = weight  # 0.0 - 1.0
        self.value = value    # 0.0 - 1.0 (normalized)
        self.description = description

    @property
    def contribution(self) -> float:
        return self.weight * self.value * 100

    def to_dict(self) -> dict[str, Any]:
        return {
            "factor": self.name,
            "weight": self.weight,
            "value": self.value,
            "contribution": round(self.contribution, 1),
            "description": self.description,
        }


class RiskScoringEngine:
    """
    Computes composite risk scores for entities.
    Score range: 0 (no risk) to 100 (critical risk).
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def score_user(self, user_id: str, email: Optional[str] = None) -> dict[str, Any]:
        """Compute risk score for a user."""
        factors: list[RiskFactor] = []

        # Factor 1: Failed login frequency
        failed_logins = await self._count_events(
            actor=email or user_id,
            event_type="login_failed",
            hours=24,
        )
        if failed_logins > 0:
            normalized = min(failed_logins / 20.0, 1.0)
            factors.append(RiskFactor(
                "failed_logins",
                weight=0.25,
                value=normalized,
                description=f"{failed_logins} failed login(s) in 24h",
            ))

        # Factor 2: Multiple countries
        countries = await self._get_unique_countries(email or user_id, hours=24)
        if len(countries) > 1:
            normalized = min((len(countries) - 1) / 3.0, 1.0)
            factors.append(RiskFactor(
                "multiple_countries",
                weight=0.20,
                value=normalized,
                description=f"Activity from {len(countries)} countries",
            ))

        # Factor 3: Admin access
        is_admin = await self._check_admin_access(user_id)
        if is_admin:
            factors.append(RiskFactor(
                "admin_access",
                weight=0.15,
                value=0.5,  # Admin access is inherently risky
                description="User has administrative privileges",
            ))

        # Factor 4: MFA status
        mfa_enabled = await self._check_mfa(user_id)
        if not mfa_enabled:
            factors.append(RiskFactor(
                "no_mfa",
                weight=0.15,
                value=0.7,
                description="MFA not enabled",
            ))

        # Factor 5: Token reuse events
        token_events = await self._count_events(
            actor=email or user_id,
            event_type="auth.token_reuse",
            hours=24,
        )
        if token_events > 0:
            factors.append(RiskFactor(
                "token_reuse",
                weight=0.15,
                value=min(token_events / 3.0, 1.0),
                description=f"{token_events} token reuse event(s)",
            ))

        # Factor 6: Known malicious IP associations
        malicious_ips = await self._check_malicious_ips(email or user_id)
        if malicious_ips > 0:
            factors.append(RiskFactor(
                "malicious_ip",
                weight=0.10,
                value=min(malicious_ips / 2.0, 1.0),
                description=f"Associated with {malicious_ips} suspicious IP(s)",
            ))

        # Calculate composite score
        total_score = min(sum(f.contribution for f in factors), 100)
        score = round(total_score)

        # Store the score
        await self._store_score("user", user_id, score, factors)

        return {
            "entity_type": "user",
            "entity_id": user_id,
            "email": email,
            "score": score,
            "risk_level": self._score_to_level(score),
            "factors": [f.to_dict() for f in factors],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def score_ip(self, ip: str) -> dict[str, Any]:
        """Compute risk score for an IP address."""
        factors: list[RiskFactor] = []

        # Check IP history
        try:
            resp = (
                self.db.table("security_ip_history")
                .select("*")
                .eq("ip", ip)
                .limit(1)
                .execute()
            )
            ip_data = resp.data[0] if resp.data else None
        except Exception:
            ip_data = None

        if ip_data:
            # Abuse score
            abuse = ip_data.get("abuse_score", 0)
            if abuse > 0:
                factors.append(RiskFactor(
                    "abuse_score",
                    weight=0.30,
                    value=abuse / 100.0,
                    description=f"Abuse reputation score: {abuse}/100",
                ))

            # VPN/Tor/Proxy
            if ip_data.get("is_tor"):
                factors.append(RiskFactor("tor_exit", weight=0.25, value=1.0, description="Tor exit node"))
            elif ip_data.get("is_vpn"):
                factors.append(RiskFactor("vpn", weight=0.15, value=0.5, description="VPN detected"))
            elif ip_data.get("is_proxy"):
                factors.append(RiskFactor("proxy", weight=0.15, value=0.6, description="Known proxy"))

            # Event volume
            event_count = ip_data.get("event_count", 0)
            if event_count > 10:
                factors.append(RiskFactor(
                    "high_volume",
                    weight=0.20,
                    value=min(event_count / 100.0, 1.0),
                    description=f"{event_count} total events from this IP",
                ))

        # Check IOC matches
        try:
            ioc_resp = (
                self.db.table("security_iocs")
                .select("id", count="exact")
                .eq("ioc_type", "ip")
                .eq("value", ip)
                .execute()
            )
            ioc_count = ioc_resp.count or 0
            if ioc_count > 0:
                factors.append(RiskFactor(
                    "ioc_match",
                    weight=0.30,
                    value=1.0,
                    description=f"Matches {ioc_count} threat feed IOC(s)",
                ))
        except Exception:
            pass

        total_score = min(sum(f.contribution for f in factors), 100)
        score = round(total_score)

        await self._store_score("ip", ip, score, factors)

        return {
            "entity_type": "ip",
            "entity_id": ip,
            "score": score,
            "risk_level": self._score_to_level(score),
            "factors": [f.to_dict() for f in factors],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _count_events(self, actor: str, event_type: str, hours: int) -> int:
        """Count events of a given type for an actor within a time window."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=hours)
            ).isoformat()
            resp = (
                self.db.table("security_events")
                .select("id", count="exact")
                .eq("actor", actor)
                .eq("event_type", event_type)
                .gte("created_at", window_start)
                .execute()
            )
            return resp.count or 0
        except Exception:
            return 0

    async def _get_unique_countries(self, actor: str, hours: int) -> list[str]:
        """Get unique countries an actor has been seen from."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=hours)
            ).isoformat()
            resp = (
                self.db.table("security_sessions")
                .select("country")
                .eq("user_id", actor)
                .gte("created_at", window_start)
                .execute()
            )
            countries = set(r.get("country") for r in (resp.data or []) if r.get("country"))
            return list(countries)
        except Exception:
            return []

    async def _check_admin_access(self, user_id: str) -> bool:
        """Check if user has admin role."""
        try:
            resp = (
                self.db.table("security_users")
                .select("role")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                return resp.data[0].get("role") in ("admin", "superadmin")
        except Exception:
            pass
        return False

    async def _check_mfa(self, user_id: str) -> bool:
        """Check if user has MFA enabled."""
        try:
            resp = (
                self.db.table("security_users")
                .select("mfa_enabled")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                return resp.data[0].get("mfa_enabled", False)
        except Exception:
            pass
        return False

    async def _check_malicious_ips(self, actor: str) -> int:
        """Count malicious IPs associated with this actor."""
        try:
            window_start = (
                datetime.now(timezone.utc) - timedelta(hours=72)
            ).isoformat()
            events_resp = (
                self.db.table("security_events")
                .select("ip")
                .eq("actor", actor)
                .gte("created_at", window_start)
                .execute()
            )
            ips = set(str(e.get("ip", "")) for e in (events_resp.data or []) if e.get("ip"))

            malicious_count = 0
            for ip in list(ips)[:10]:  # Limit lookups
                ip_resp = (
                    self.db.table("security_ip_history")
                    .select("abuse_score")
                    .eq("ip", ip)
                    .limit(1)
                    .execute()
                )
                if ip_resp.data and (ip_resp.data[0].get("abuse_score", 0) > 70):
                    malicious_count += 1

            return malicious_count
        except Exception:
            return 0

    async def _store_score(self, entity_type: str, entity_id: str, score: int, factors: list[RiskFactor]):
        """Store the computed risk score."""
        try:
            self.db.table("security_risk_scores").insert({
                "entity_type": entity_type,
                "entity_id": entity_id,
                "score": score,
                "factors": [f.to_dict() for f in factors],
                "model_version": "risk-engine-1.0",
            }).execute()
        except Exception as exc:
            logger.warning("Failed to store risk score: %s", exc)

    @staticmethod
    def _score_to_level(score: int) -> str:
        """Convert numeric score to risk level."""
        if score >= 80:
            return "critical"
        elif score >= 60:
            return "high"
        elif score >= 40:
            return "medium"
        elif score >= 20:
            return "low"
        return "minimal"
