"""Token anomaly detection rule."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import DetectionRule, MitreMapping, RuleSeverity, RuleStatus, SuppressionConfig


@dataclass
class TokenAnomalyDetection(DetectionRule):
    """Detects token reuse from a different IP or device than the original session."""

    rule_id: str = "AUTH-004"
    name: str = "Token Reuse Anomaly"
    description: str = "Authentication token used from a different IP or device than the original session"
    version: str = "1.0.0"
    category: str = "authentication"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 90
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping(
            tactic_id="TA0006",
            tactic_name="Credential Access",
            technique_id="T1528",
            technique_name="Steal Application Access Token",
        ),
    ])
    suppression: SuppressionConfig = field(default_factory=lambda: SuppressionConfig(
        cooldown_seconds=60,
        deduplicate_by=["actor", "ip"],
        max_alerts_per_hour=10,
    ))
    tags: list[str] = field(default_factory=lambda: ["authentication", "token-theft", "session-hijack"])
    false_positive_guidance: str = "Mobile users switching between WiFi and cellular may trigger this."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Trigger on token reuse events."""
        if "token_reuse" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        return {
            "description": f"Token reuse detected for {event.get('actor')} from {event.get('ip')}",
            "severity": "critical",
            "evidence": {
                "original_ip": metadata.get("original_ip"),
                "current_ip": event.get("ip"),
                "token_age_hours": metadata.get("token_age_hours"),
            },
        }
