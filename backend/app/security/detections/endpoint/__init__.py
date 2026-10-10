"""Endpoint detection rules — ransomware, malware indicators, host anomalies."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class RansomwarePrecursorDetection(DetectionRule):
    """Detects ransomware precursor activity (shadow copy deletion, mass encryption)."""

    rule_id: str = "EPT-001"
    name: str = "Ransomware Precursor Activity"
    description: str = "Shadow copy deletion or mass file encryption indicating ransomware"
    version: str = "1.0.0"
    category: str = "endpoint"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 92
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0040", "Impact", "T1490", "Inhibit System Recovery"),
        MitreMapping("TA0040", "Impact", "T1486", "Data Encrypted for Impact"),
    ])
    tags: list[str] = field(default_factory=lambda: ["endpoint", "ransomware", "encryption"])
    false_positive_guidance: str = "Legitimate backup software may delete old shadow copies."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        event_type = event.get("event_type", "")
        if "shadow_copy_deleted" in event_type or "encryption_activity" in event_type:
            return {
                "description": f"Ransomware precursor: {event_type} on {event.get('actor')}",
                "severity": "critical",
                "evidence": event.get("metadata", {}),
            }
        return None


@dataclass
class SuspiciousProcessDetection(DetectionRule):
    """Detects suspicious process execution patterns."""

    rule_id: str = "EPT-002"
    name: str = "Suspicious Process Execution"
    description: str = "Execution of known-malicious tools or suspicious command patterns"
    version: str = "1.0.0"
    category: str = "endpoint"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 75
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0002", "Execution", "T1059", "Command and Scripting Interpreter"),
    ])
    tags: list[str] = field(default_factory=lambda: ["endpoint", "process", "execution"])
    suspicious_commands: list[str] = field(default_factory=lambda: [
        "mimikatz", "psexec", "cobalt", "meterpreter", "powershell -enc",
        "certutil -urlcache", "bitsadmin /transfer",
    ])
    false_positive_guidance: str = "Security testing tools may trigger this during authorized assessments."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "process" not in event.get("event_type", "") and "execution" not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        command = str(metadata.get("command", "")).lower()

        for suspicious in self.suspicious_commands:
            if suspicious.lower() in command:
                return {
                    "description": f"Suspicious process: '{suspicious}' detected on {event.get('actor')}",
                    "severity": "high",
                    "evidence": {"command": command, "matched_pattern": suspicious},
                }
        return None


DETECTION_REGISTRY.register(RansomwarePrecursorDetection())
DETECTION_REGISTRY.register(SuspiciousProcessDetection())
