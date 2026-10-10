"""Brute force login detection rule."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import DetectionRule, MitreMapping, RuleSeverity, RuleStatus, SuppressionConfig


@dataclass
class BruteForceDetection(DetectionRule):
    """Detects brute force login attempts against a single account."""

    rule_id: str = "AUTH-001"
    name: str = "Brute Force Login"
    description: str = "Multiple failed login attempts against a single account within a short time window"
    version: str = "2.0.0"
    category: str = "authentication"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 85
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping(
            tactic_id="TA0006",
            tactic_name="Credential Access",
            technique_id="T1110",
            technique_name="Brute Force",
            subtechnique_id="T1110.001",
            subtechnique_name="Password Guessing",
        ),
    ])
    suppression: SuppressionConfig = field(default_factory=lambda: SuppressionConfig(
        cooldown_seconds=300,
        deduplicate_by=["actor"],
        max_alerts_per_hour=5,
    ))
    tags: list[str] = field(default_factory=lambda: ["authentication", "brute-force", "credential-access"])
    threshold: int = 5
    window_minutes: int = 10
    false_positive_guidance: str = "May trigger for users who forgot their password. Check if a successful login follows."
    references: list[str] = field(default_factory=lambda: [
        "https://attack.mitre.org/techniques/T1110/001/",
    ])

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Trigger if actor has >= threshold failed logins in the window."""
        if "login_failed" not in event.get("event_type", "") and "auth.login_failed" not in event.get("event_type", ""):
            return None

        actor_events = context.get("actor_events", [])
        failed_count = sum(
            1 for e in actor_events
            if "login_failed" in e.get("event_type", "") or "auth.login_failed" in e.get("event_type", "")
        )

        if failed_count >= self.threshold:
            return {
                "description": f"Brute force detected: {failed_count} failed logins for {event.get('actor', 'unknown')}",
                "evidence": {
                    "failed_count": failed_count,
                    "threshold": self.threshold,
                    "window_minutes": self.window_minutes,
                    "source_ip": event.get("ip"),
                },
            }

        return None
