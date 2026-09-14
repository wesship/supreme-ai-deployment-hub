"""Guardian screening for external prompt ingestion.

External prompt material is treated as untrusted data. This module reuses the
existing AI-001 PromptInjectionDetection rule and adds ingestion-specific checks
for authority escalation, secret exfiltration, and unsafe tool bypass language.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.security.detections.ai import PromptInjectionDetection


@dataclass(frozen=True)
class PromptScreeningResult:
    decision: str  # allow | review | quarantine
    risk_score: float
    findings: tuple[str, ...]


_HIGH_RISK_PATTERNS: tuple[tuple[str, str], ...] = (
    ("disable guardian", "attempts to disable Guardian"),
    ("bypass guardian", "attempts to bypass Guardian"),
    ("without authorization", "requests unauthorized execution"),
    ("without approval", "requests approval bypass"),
    ("reveal your system prompt", "requests protected system instructions"),
    ("show your system prompt", "requests protected system instructions"),
    ("send stored secrets", "requests secret exfiltration"),
    ("exfiltrate", "contains exfiltration language"),
    ("api key", "references credential material"),
    ("service role key", "references privileged credential material"),
    ("act as the system administrator", "attempts authority escalation"),
    ("ignore policy", "attempts policy bypass"),
    ("ignore safety", "attempts safety bypass"),
)

_MEDIUM_RISK_PATTERNS: tuple[tuple[str, str], ...] = (
    ("execute immediately", "requests immediate execution"),
    ("do not ask for confirmation", "suppresses approval interaction"),
    ("do not tell the user", "requests concealed behavior"),
    ("hidden instruction", "references hidden instructions"),
    ("override", "contains override language"),
)


class PromptGuardianScanner:
    """Deterministic pre-ingestion scanner for untrusted prompt content."""

    def __init__(self) -> None:
        self._injection_rule = PromptInjectionDetection()

    async def scan(self, content: str, *, source: str = "external") -> PromptScreeningResult:
        text = content.strip()
        if not text:
            return PromptScreeningResult("quarantine", 1.0, ("empty prompt content",))

        findings: list[str] = []
        normalized = text.lower()

        detection = await self._injection_rule.evaluate(
            {
                "event_type": "ai.prompt.ingestion",
                "actor": source,
                "metadata": {"prompt": text},
            },
            {},
        )
        if detection:
            matched = detection.get("evidence", {}).get("matched_pattern", "AI-001")
            findings.append(f"AI-001 prompt injection pattern: {matched}")

        high_hits = self._find_patterns(normalized, _HIGH_RISK_PATTERNS)
        medium_hits = self._find_patterns(normalized, _MEDIUM_RISK_PATTERNS)
        findings.extend(high_hits)
        findings.extend(medium_hits)

        if detection or high_hits:
            # Quarantine direct injection/authority/credential attacks. Keep the
            # exact score below 1.0 so future evaluators can still distinguish
            # malformed/empty data from detected hostile content.
            score = min(0.99, 0.80 + (0.04 * len(high_hits)) + (0.05 if detection else 0.0))
            return PromptScreeningResult("quarantine", score, tuple(dict.fromkeys(findings)))

        if medium_hits:
            score = min(0.79, 0.45 + (0.07 * len(medium_hits)))
            return PromptScreeningResult("review", score, tuple(dict.fromkeys(findings)))

        return PromptScreeningResult("allow", 0.10, ())

    @staticmethod
    def _find_patterns(text: str, patterns: Iterable[tuple[str, str]]) -> list[str]:
        return [description for pattern, description in patterns if pattern in text]
