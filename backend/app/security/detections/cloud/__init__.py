"""Cloud detection rules — misconfigurations, supply chain, resource abuse."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class SupplyChainAttackDetection(DetectionRule):
    """Detects compromised dependencies or supply chain indicators."""

    rule_id: str = "CLD-001"
    name: str = "Supply Chain Compromise"
    description: str = "Compromised dependency installed or critical vulnerability in production"
    version: str = "1.0.0"
    category: str = "cloud"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 80
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0001", "Initial Access", "T1195", "Supply Chain Compromise", "T1195.002", "Compromise Software Supply Chain"),
    ])
    tags: list[str] = field(default_factory=lambda: ["cloud", "supply-chain", "dependency"])
    false_positive_guidance: str = "Dependabot alerts for low-severity issues may trigger. Focus on critical CVEs."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        event_type = event.get("event_type", "")
        if "vulnerability_detected" not in event_type and "package_installed" not in event_type:
            return None

        metadata = event.get("metadata", {})
        severity = metadata.get("severity", "")

        if severity == "critical" or "malicious" in str(metadata.get("package", "")).lower():
            return {
                "description": f"Supply chain risk: {metadata.get('package', 'unknown')} ({metadata.get('cve', 'no CVE')})",
                "severity": "critical",
                "evidence": metadata,
            }
        return None


@dataclass
class SecretLeakDetection(DetectionRule):
    """Detects exposed secrets in code or configuration."""

    rule_id: str = "CLD-002"
    name: str = "Secret/Credential Leak"
    description: str = "API key, token, or credential exposed in code repository or logs"
    version: str = "1.0.0"
    category: str = "cloud"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 95
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0006", "Credential Access", "T1552", "Unsecured Credentials", "T1552.001", "Credentials In Files"),
    ])
    tags: list[str] = field(default_factory=lambda: ["cloud", "secret-leak", "credential-exposure"])
    false_positive_guidance: str = "Test/example keys in documentation may trigger. Verify the key is live."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "secret_leak" not in event.get("event_type", "") and "credential_exposed" not in event.get("event_type", ""):
            return None
        return {
            "description": f"Secret leaked: {event.get('metadata', {}).get('secret_type', 'unknown')} in {event.get('metadata', {}).get('location', 'unknown')}",
            "severity": "critical",
            "evidence": event.get("metadata", {}),
        }


@dataclass
class CloudMisconfigurationDetection(DetectionRule):
    """Detects dangerous cloud misconfigurations."""

    rule_id: str = "CLD-003"
    name: str = "Cloud Misconfiguration"
    description: str = "Dangerous cloud resource misconfiguration (public buckets, open ports, etc.)"
    version: str = "1.0.0"
    category: str = "cloud"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 85
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0001", "Initial Access", "T1190", "Exploit Public-Facing Application"),
    ])
    tags: list[str] = field(default_factory=lambda: ["cloud", "misconfiguration", "exposure"])
    false_positive_guidance: str = "Some public resources (CDN, static assets) are intentionally public."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "misconfiguration" not in event.get("event_type", "") and "public_exposure" not in event.get("event_type", ""):
            return None
        return {
            "description": f"Cloud misconfiguration: {event.get('metadata', {}).get('resource', 'unknown')}",
            "evidence": event.get("metadata", {}),
        }


DETECTION_REGISTRY.register(SupplyChainAttackDetection())
DETECTION_REGISTRY.register(SecretLeakDetection())
DETECTION_REGISTRY.register(CloudMisconfigurationDetection())
