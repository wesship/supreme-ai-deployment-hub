"""Fail-closed SG-4 smart-glasses canary validator.

This module validates canary policy/evidence only. It never enables adapters or
executes device actions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CanaryResult:
    status: str
    failures: tuple[str, ...]


def validate_canary(*, policy: dict[str, Any], sg3: dict[str, Any], evidence: dict[str, Any]) -> CanaryResult:
    failures: list[str] = []
    requirements = policy.get("activation_requirements", {})

    if policy.get("production_enabled") is not False:
        failures.append("policy must remain production_enabled=false during certification")
    if sg3.get("status") != requirements.get("sg3_status", "PASS"):
        failures.append("SG-3 hardware certification has not passed")

    cohort = policy.get("cohort", {})
    if cohort.get("mode") != "explicit_device_allowlist" or not cohort.get("device_ids"):
        failures.append("explicit non-empty device allowlist is required")

    allowed = set(policy.get("allowed_actions", []))
    guardian_only = set(policy.get("guardian_only_actions", []))
    if allowed & guardian_only:
        failures.append("allowed and guardian-only action sets must not overlap")

    if evidence.get("canary_hours", 0) < requirements.get("minimum_canary_hours", 24):
        failures.append("minimum canary duration not met")
    if evidence.get("unsafe_dispatches") != requirements.get("maximum_unsafe_dispatches", 0):
        failures.append("unsafe dispatch detected or evidence missing")
    false_rate = evidence.get("false_dispatch_rate")
    if false_rate is None or false_rate > requirements.get("maximum_false_dispatch_rate", 0.0):
        failures.append("false dispatch rate above threshold or missing")
    error_rate = evidence.get("error_rate")
    if error_rate is None or error_rate > requirements.get("maximum_error_rate", 0.02):
        failures.append("error rate above threshold or missing")
    p95 = evidence.get("p95_latency_ms")
    if p95 is None or p95 > requirements.get("maximum_p95_latency_ms", 750):
        failures.append("p95 latency above threshold or missing")

    for field in ("rollback_test_verified", "kill_switch_test_verified"):
        if evidence.get(field) is not True:
            failures.append(f"{field} must be true")

    reviewer = evidence.get("reviewer")
    reviewed_at = evidence.get("reviewed_at")
    if requirements.get("human_reviewer_required", True) and (not reviewer or not reviewed_at):
        failures.append("human reviewer evidence is required")

    observed_actions = set(evidence.get("observed_actions", []))
    if not observed_actions.issubset(allowed):
        failures.append("canary evidence contains action outside low-risk allowlist")

    return CanaryResult("PASS" if not failures else "BLOCKED", tuple(failures))
