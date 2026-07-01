"""Impossible travel detection rule."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import DetectionRule, MitreMapping, RuleSeverity, RuleStatus, SuppressionConfig


@dataclass
class ImpossibleTravelDetection(DetectionRule):
    """Detects logins from geographically distant locations in impossible timeframes."""

    rule_id: str = "AUTH-003"
    name: str = "Impossible Travel"
    description: str = "Login from a geographically distant location within an impossibly short time"
    version: str = "1.0.0"
    category: str = "authentication"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 75
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping(
            tactic_id="TA0001",
            tactic_name="Initial Access",
            technique_id="T1078",
            technique_name="Valid Accounts",
        ),
    ])
    suppression: SuppressionConfig = field(default_factory=lambda: SuppressionConfig(
        cooldown_seconds=3600,
        deduplicate_by=["actor"],
        max_alerts_per_hour=2,
    ))
    tags: list[str] = field(default_factory=lambda: ["authentication", "impossible-travel", "geo-anomaly"])
    false_positive_guidance: str = "VPN usage can cause false positives. Check if the user routinely uses VPNs."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Trigger if login occurs from a new country with recent activity from another."""
        if "login_success" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        current_country = metadata.get("country")
        if not current_country:
            return None

        # Check recent events for different country
        actor_events = context.get("actor_events", [])
        for prev_event in actor_events:
            prev_meta = prev_event.get("metadata", {}) if isinstance(prev_event.get("metadata"), dict) else {}
            prev_country = prev_meta.get("country")
            if prev_country and prev_country != current_country:
                return {
                    "description": f"Impossible travel: {event.get('actor')} logged in from {current_country} after recent activity from {prev_country}",
                    "severity": "high",
                    "evidence": {
                        "current_country": current_country,
                        "previous_country": prev_country,
                        "current_ip": event.get("ip"),
                    },
                }

        return None
