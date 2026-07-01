"""
backend/app/security/detections/ — Structured Detection Engineering Layer

Organized detection rules by category with support for:
- Versioned rules with semantic versioning
- Severity classification (critical, high, medium, low, informational)
- MITRE ATT&CK tactic and technique mappings
- Suppression logic (cooldown, deduplication)
- Confidence scoring (0-100)
- Testing harness for rule validation
- Rule lifecycle (draft → testing → active → deprecated)

Directory structure:
  authentication/  — Login, MFA, token, session detections
  identity/        — Privilege escalation, account changes
  endpoint/        — Host-based detections
  api/             — API abuse, rate limiting, unauthorized access
  network/         — Network anomalies, C2, lateral movement
  cloud/           — Cloud resource misuse, misconfigurations
  ai/              — AI/ML model abuse, prompt injection
  fraud/           — Business logic abuse, financial fraud
"""

from .base import DetectionRule, DetectionRegistry, RuleStatus, RuleSeverity
from .engine import StructuredDetectionEngine

__all__ = [
    "DetectionRule",
    "DetectionRegistry",
    "RuleStatus",
    "RuleSeverity",
    "StructuredDetectionEngine",
]
