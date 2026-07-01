"""API detection rules — rate limiting, unauthorized access, abuse patterns."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class APIRateLimitAbuse(DetectionRule):
    """Detects sustained API rate limit violations."""

    rule_id: str = "API-001"
    name: str = "API Rate Limit Abuse"
    description: str = "Sustained API rate limit violations indicating automated abuse"
    version: str = "1.0.0"
    category: str = "api"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 80
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0040", "Impact", "T1498", "Network Denial of Service"),
    ])
    tags: list[str] = field(default_factory=lambda: ["api", "rate-limit", "abuse", "dos"])
    threshold: int = 10
    false_positive_guidance: str = "Legitimate integrations may hit rate limits during batch operations."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "rate_limit" not in event.get("event_type", ""):
            return None

        actor_events = context.get("actor_events", [])
        rate_limit_events = [e for e in actor_events if "rate_limit" in e.get("event_type", "")]

        if len(rate_limit_events) >= self.threshold:
            return {
                "description": f"API abuse: {len(rate_limit_events)} rate limit violations from {event.get('actor')}",
                "evidence": {
                    "violations": len(rate_limit_events),
                    "threshold": self.threshold,
                    "source_ip": event.get("ip"),
                },
            }
        return None


@dataclass
class UnauthorizedAPIAccess(DetectionRule):
    """Detects repeated unauthorized API access attempts."""

    rule_id: str = "API-002"
    name: str = "Unauthorized API Access"
    description: str = "Repeated attempts to access API endpoints without proper authorization"
    version: str = "1.0.0"
    category: str = "api"
    severity: RuleSeverity = RuleSeverity.MEDIUM
    confidence: int = 75
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0007", "Discovery", "T1087", "Account Discovery"),
    ])
    tags: list[str] = field(default_factory=lambda: ["api", "unauthorized", "enumeration"])
    threshold: int = 5
    false_positive_guidance: str = "Misconfigured API clients may repeatedly send invalid tokens."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "unauthorized" not in event.get("event_type", "") and "403" not in str(event.get("metadata", {}).get("status_code", "")):
            return None

        actor_events = context.get("actor_events", [])
        unauth_events = [
            e for e in actor_events
            if "unauthorized" in e.get("event_type", "") or "403" in str(e.get("severity", ""))
        ]

        if len(unauth_events) >= self.threshold:
            return {
                "description": f"Repeated unauthorized API access from {event.get('actor', event.get('ip'))}",
                "evidence": {"attempts": len(unauth_events), "source_ip": event.get("ip")},
            }
        return None


@dataclass
class DataExfiltrationViaAPI(DetectionRule):
    """Detects potential data exfiltration through bulk API exports."""

    rule_id: str = "API-003"
    name: str = "Data Exfiltration via API"
    description: str = "Unusually large data export through API endpoints"
    version: str = "1.0.0"
    category: str = "api"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 70
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0010", "Exfiltration", "T1567", "Exfiltration Over Web Service"),
    ])
    tags: list[str] = field(default_factory=lambda: ["api", "exfiltration", "data-loss"])
    record_threshold: int = 10000
    false_positive_guidance: str = "Scheduled backup jobs and analytics exports may trigger this."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "bulk_export" not in event.get("event_type", "") and "data_export" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        records = metadata.get("records", 0)

        if records >= self.record_threshold:
            return {
                "description": f"Potential data exfiltration: {records} records exported by {event.get('actor')}",
                "severity": "critical",
                "evidence": {
                    "records": records,
                    "table": metadata.get("table"),
                    "destination": metadata.get("destination"),
                },
            }
        return None


# Register all API rules
DETECTION_REGISTRY.register(APIRateLimitAbuse())
DETECTION_REGISTRY.register(UnauthorizedAPIAccess())
DETECTION_REGISTRY.register(DataExfiltrationViaAPI())
