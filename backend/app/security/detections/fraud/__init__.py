"""Fraud detection rules — business logic abuse, financial fraud."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class AnomalousTransactionDetection(DetectionRule):
    """Detects anomalous financial transactions."""

    rule_id: str = "FRD-001"
    name: str = "Anomalous Transaction"
    description: str = "Financial transaction significantly outside normal patterns"
    version: str = "1.0.0"
    category: str = "fraud"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 60
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=list)
    tags: list[str] = field(default_factory=lambda: ["fraud", "transaction", "financial"])
    amount_threshold: float = 10000.0
    false_positive_guidance: str = "Enterprise customers may have legitimately large transactions."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "transaction" not in event.get("event_type", "") and "payment" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        amount = float(metadata.get("amount", 0))

        if amount >= self.amount_threshold:
            return {
                "description": f"Anomalous transaction: ${amount:,.2f} by {event.get('actor')}",
                "evidence": {"amount": amount, "threshold": self.amount_threshold, "currency": metadata.get("currency")},
            }
        return None


@dataclass
class AccountCreationSpreeDetection(DetectionRule):
    """Detects mass account creation from a single source."""

    rule_id: str = "FRD-002"
    name: str = "Mass Account Creation"
    description: str = "Multiple accounts created from the same IP in a short period"
    version: str = "1.0.0"
    category: str = "fraud"
    severity: RuleSeverity = RuleSeverity.MEDIUM
    confidence: int = 75
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0042", "Resource Development", "T1585", "Establish Accounts"),
    ])
    tags: list[str] = field(default_factory=lambda: ["fraud", "account-creation", "bot"])
    threshold: int = 5
    false_positive_guidance: str = "Onboarding events for enterprise customers may create multiple accounts."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "account_created" not in event.get("event_type", "") and "signup" not in event.get("event_type", ""):
            return None

        ip_events = context.get("ip_events", [])
        signups = [e for e in ip_events if "account_created" in e.get("event_type", "") or "signup" in e.get("event_type", "")]

        if len(signups) >= self.threshold:
            return {
                "description": f"Mass account creation: {len(signups)} accounts from IP {event.get('ip')}",
                "evidence": {"accounts_created": len(signups), "source_ip": event.get("ip")},
            }
        return None


DETECTION_REGISTRY.register(AnomalousTransactionDetection())
DETECTION_REGISTRY.register(AccountCreationSpreeDetection())
