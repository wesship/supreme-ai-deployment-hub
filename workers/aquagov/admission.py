"""Admission gate for AquaGov GPU workers.

A worker may not claim production work unless required preflight checks pass.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class AdmissionDecision:
    admitted: bool
    reason: str
    checks: list[dict[str, Any]]


def evaluate_preflight(result: dict[str, Any]) -> AdmissionDecision:
    checks = result.get("checks", [])
    if not isinstance(checks, list):
        return AdmissionDecision(False, "invalid_preflight_result", [])

    failures = [c for c in checks if c.get("required", True) and not c.get("ok", False)]
    if failures:
        names = ", ".join(str(c.get("name", "unknown")) for c in failures)
        return AdmissionDecision(False, f"required_checks_failed:{names}", checks)
    if result.get("ready") is not True:
        return AdmissionDecision(False, "preflight_not_ready", checks)
    return AdmissionDecision(True, "preflight_passed", checks)


def admit_worker(run_preflight: Callable[[], dict[str, Any]]) -> AdmissionDecision:
    """Run preflight immediately before worker admission."""
    try:
        result = run_preflight()
    except Exception as exc:
        return AdmissionDecision(False, f"preflight_error:{type(exc).__name__}", [])
    return evaluate_preflight(result)
