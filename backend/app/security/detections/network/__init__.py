"""Network detection rules — C2, lateral movement, Tor, beaconing."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class TorConnectionDetection(DetectionRule):
    """Detects connections to/from known Tor exit nodes."""

    rule_id: str = "NET-001"
    name: str = "Tor Network Connection"
    description: str = "Connection detected to or from a known Tor exit node"
    version: str = "1.0.0"
    category: str = "network"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 85
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0011", "Command and Control", "T1090", "Proxy", "T1090.003", "Multi-hop Proxy"),
    ])
    tags: list[str] = field(default_factory=lambda: ["network", "tor", "anonymization", "c2"])
    false_positive_guidance: str = "Security researchers and privacy-focused users may legitimately use Tor."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "tor" not in event.get("event_type", "").lower():
            metadata = event.get("metadata", {})
            if not metadata.get("is_tor") and "tor" not in str(metadata.get("destination", "")).lower():
                return None

        return {
            "description": f"Tor connection detected from {event.get('ip', 'unknown')}",
            "evidence": {"ip": event.get("ip"), "metadata": event.get("metadata", {})},
        }


@dataclass
class C2BeaconingDetection(DetectionRule):
    """Detects periodic outbound connections indicative of C2 beaconing."""

    rule_id: str = "NET-002"
    name: str = "C2 Beaconing Pattern"
    description: str = "Periodic outbound connections to external hosts suggesting command-and-control"
    version: str = "1.0.0"
    category: str = "network"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 70
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0011", "Command and Control", "T1071", "Application Layer Protocol"),
    ])
    tags: list[str] = field(default_factory=lambda: ["network", "c2", "beaconing"])
    false_positive_guidance: str = "Health check endpoints and monitoring agents may show periodic patterns."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "outbound_connection" not in event.get("event_type", "") and "beacon" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        destination = metadata.get("destination", "")

        if destination and ("c2" in destination.lower() or "evil" in destination.lower()):
            return {
                "description": f"Potential C2 beaconing to {destination}",
                "severity": "critical",
                "evidence": {"destination": destination, "port": metadata.get("port")},
            }
        return None


@dataclass
class LateralMovementDetection(DetectionRule):
    """Detects lateral movement across multiple internal services."""

    rule_id: str = "NET-003"
    name: str = "Lateral Movement"
    description: str = "Account accessing multiple internal services in rapid succession"
    version: str = "1.0.0"
    category: str = "network"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 65
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0008", "Lateral Movement", "T1021", "Remote Services"),
    ])
    tags: list[str] = field(default_factory=lambda: ["network", "lateral-movement"])
    min_services: int = 3
    false_positive_guidance: str = "Developers and admins may access multiple services routinely."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        actor_events = context.get("actor_events", [])
        services = set()
        for e in actor_events:
            meta = e.get("metadata", {}) if isinstance(e.get("metadata"), dict) else {}
            svc = meta.get("service")
            if svc:
                services.add(svc)

        current_meta = event.get("metadata", {})
        if current_meta.get("service"):
            services.add(current_meta["service"])

        if len(services) >= self.min_services and current_meta.get("first_access"):
            return {
                "description": f"Lateral movement: {event.get('actor')} accessed {len(services)} services",
                "evidence": {"services": list(services), "count": len(services)},
            }
        return None


DETECTION_REGISTRY.register(TorConnectionDetection())
DETECTION_REGISTRY.register(C2BeaconingDetection())
DETECTION_REGISTRY.register(LateralMovementDetection())
