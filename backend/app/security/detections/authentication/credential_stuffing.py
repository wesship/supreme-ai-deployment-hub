"""Credential stuffing detection rule."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import DetectionRule, MitreMapping, RuleSeverity, RuleStatus, SuppressionConfig


@dataclass
class CredentialStuffingDetection(DetectionRule):
    """Detects credential stuffing: single IP targeting multiple accounts."""

    rule_id: str = "AUTH-002"
    name: str = "Credential Stuffing"
    description: str = "Single IP address attempting login against multiple different accounts"
    version: str = "1.0.0"
    category: str = "authentication"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 80
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping(
            tactic_id="TA0006",
            tactic_name="Credential Access",
            technique_id="T1110",
            technique_name="Brute Force",
            subtechnique_id="T1110.004",
            subtechnique_name="Credential Stuffing",
        ),
    ])
    suppression: SuppressionConfig = field(default_factory=lambda: SuppressionConfig(
        cooldown_seconds=600,
        deduplicate_by=["ip"],
        max_alerts_per_hour=3,
    ))
    tags: list[str] = field(default_factory=lambda: ["authentication", "credential-stuffing", "spray"])
    min_unique_actors: int = 3
    false_positive_guidance: str = "May trigger for shared corporate IPs or VPNs with multiple users."
    references: list[str] = field(default_factory=lambda: [
        "https://attack.mitre.org/techniques/T1110/004/",
    ])

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Trigger if a single IP is targeting multiple unique actors."""
        if "login_failed" not in event.get("event_type", ""):
            return None

        unique_actors = context.get("ip_unique_actors", 0)

        if unique_actors >= self.min_unique_actors:
            return {
                "description": f"Credential stuffing: IP {event.get('ip')} targeting {unique_actors} accounts",
                "evidence": {
                    "unique_actors": unique_actors,
                    "threshold": self.min_unique_actors,
                    "source_ip": event.get("ip"),
                },
            }

        return None
