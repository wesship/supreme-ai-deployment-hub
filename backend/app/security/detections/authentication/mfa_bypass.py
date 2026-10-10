"""MFA bypass/disable detection rule."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import DetectionRule, MitreMapping, RuleSeverity, RuleStatus, SuppressionConfig


@dataclass
class MFABypassDetection(DetectionRule):
    """Detects MFA being disabled or bypassed, especially after suspicious activity."""

    rule_id: str = "AUTH-005"
    name: str = "MFA Disabled After Suspicious Activity"
    description: str = "Multi-factor authentication disabled shortly after suspicious login activity"
    version: str = "1.0.0"
    category: str = "authentication"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 88
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping(
            tactic_id="TA0003",
            tactic_name="Persistence",
            technique_id="T1098",
            technique_name="Account Manipulation",
            subtechnique_id="T1098.005",
            subtechnique_name="Device Registration",
        ),
    ])
    suppression: SuppressionConfig = field(default_factory=lambda: SuppressionConfig(
        cooldown_seconds=600,
        deduplicate_by=["actor"],
        max_alerts_per_hour=3,
    ))
    tags: list[str] = field(default_factory=lambda: ["authentication", "mfa", "persistence", "account-takeover"])
    false_positive_guidance: str = "Users may legitimately disable MFA when switching devices. Check for preceding suspicious activity."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Trigger when MFA is disabled, especially with prior suspicious activity."""
        event_type = event.get("event_type", "")
        if "mfa_disabled" not in event_type and "mfa_removed" not in event_type:
            return None

        # Check for preceding suspicious activity
        actor_alerts = context.get("actor_alerts", [])
        has_prior_alerts = len(actor_alerts) > 0

        # Always alert on MFA disable, but increase confidence if prior alerts exist
        confidence = 95 if has_prior_alerts else self.confidence

        return {
            "description": f"MFA disabled for {event.get('actor')} {'after suspicious activity' if has_prior_alerts else ''}",
            "severity": "critical" if has_prior_alerts else "high",
            "confidence": confidence,
            "evidence": {
                "prior_alerts": len(actor_alerts),
                "source_ip": event.get("ip"),
                "metadata": event.get("metadata", {}),
            },
        }
