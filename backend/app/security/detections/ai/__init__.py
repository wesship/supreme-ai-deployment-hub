"""AI/ML detection rules — model abuse, prompt injection, data poisoning."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class PromptInjectionDetection(DetectionRule):
    """Detects prompt injection attempts against AI models."""

    rule_id: str = "AI-001"
    name: str = "Prompt Injection Attempt"
    description: str = "Attempted prompt injection to manipulate AI model behavior"
    version: str = "1.0.0"
    category: str = "ai"
    severity: RuleSeverity = RuleSeverity.HIGH
    confidence: int = 70
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0002", "Execution", "T1059", "Command and Scripting Interpreter"),
    ])
    tags: list[str] = field(default_factory=lambda: ["ai", "prompt-injection", "llm-abuse"])
    injection_patterns: list[str] = field(default_factory=lambda: [
        "ignore previous instructions",
        "disregard all prior",
        "system prompt",
        "you are now",
        "act as if",
        "jailbreak",
        "DAN mode",
    ])
    false_positive_guidance: str = "Security researchers testing model robustness may trigger this."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "prompt" not in event.get("event_type", "") and "ai." not in event.get("event_type", ""):
            return None

        metadata = event.get("metadata", {})
        prompt = str(metadata.get("prompt", "") or metadata.get("input", "")).lower()

        for pattern in self.injection_patterns:
            if pattern.lower() in prompt:
                return {
                    "description": f"Prompt injection attempt by {event.get('actor')}: matched '{pattern}'",
                    "evidence": {"matched_pattern": pattern, "source_ip": event.get("ip")},
                }
        return None


@dataclass
class ModelAbuseDetection(DetectionRule):
    """Detects excessive or anomalous AI model usage."""

    rule_id: str = "AI-002"
    name: str = "AI Model Abuse"
    description: str = "Excessive AI model invocations or anomalous usage patterns"
    version: str = "1.0.0"
    category: str = "ai"
    severity: RuleSeverity = RuleSeverity.MEDIUM
    confidence: int = 65
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0040", "Impact", "T1496", "Resource Hijacking"),
    ])
    tags: list[str] = field(default_factory=lambda: ["ai", "model-abuse", "resource-consumption"])
    threshold_per_hour: int = 100
    false_positive_guidance: str = "Batch processing jobs may legitimately make many model calls."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "model" not in event.get("event_type", "") and "ai." not in event.get("event_type", ""):
            return None

        actor_events = context.get("actor_events", [])
        ai_events = [e for e in actor_events if "model" in e.get("event_type", "") or "ai." in e.get("event_type", "")]

        if len(ai_events) >= self.threshold_per_hour:
            return {
                "description": f"AI model abuse: {len(ai_events)} invocations by {event.get('actor')} in 1h",
                "evidence": {"invocations": len(ai_events), "threshold": self.threshold_per_hour},
            }
        return None


DETECTION_REGISTRY.register(PromptInjectionDetection())
DETECTION_REGISTRY.register(ModelAbuseDetection())
