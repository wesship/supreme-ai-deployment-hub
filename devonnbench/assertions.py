"""
DevonnBench v1 — Assertion Engine

Evaluates assertion definitions against live HTTP responses.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from .models import Assertion, AssertionResult, AssertionType, CriticalFailureReason


def _get_json_path(data: Any, path: str) -> Any:
    """
    Minimal dot-notation JSON path resolver.
    Supports: field, field.nested, field[0], field[0].nested
    """
    parts = re.split(r'\.|\[(\d+)\]', path)
    current = data
    for part in parts:
        if part is None or part == "":
            continue
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current


def evaluate_assertion(
    assertion: Assertion,
    *,
    http_status: Optional[int],
    response_body: Optional[str],
    response_json: Optional[Dict[str, Any]],
    latency_ms: float,
) -> AssertionResult:
    """Evaluate a single assertion. Never raises — wraps errors as failures."""
    try:
        return _evaluate(
            assertion,
            http_status=http_status,
            response_body=response_body,
            response_json=response_json,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        return AssertionResult(
            assertion=assertion,
            passed=False,
            actual=None,
            message=f"Assertion evaluation error: {exc}",
        )


def _evaluate(
    assertion: Assertion,
    *,
    http_status: Optional[int],
    response_body: Optional[str],
    response_json: Optional[Dict[str, Any]],
    latency_ms: float,
) -> AssertionResult:

    t = assertion.type

    # ------------------------------------------------------------------
    # STATUS_CODE
    # ------------------------------------------------------------------
    if t == AssertionType.STATUS_CODE:
        actual = http_status
        passed = actual == assertion.expected
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else f"Expected {assertion.expected}, got {actual}",
        )

    # ------------------------------------------------------------------
    # JSON_PATH
    # ------------------------------------------------------------------
    if t == AssertionType.JSON_PATH:
        if response_json is None:
            return AssertionResult(
                assertion=assertion,
                passed=False,
                actual=None,
                message="Response is not valid JSON",
            )
        actual = _get_json_path(response_json, assertion.field or "")
        passed = actual == assertion.expected
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else f"Path '{assertion.field}': expected {assertion.expected!r}, got {actual!r}",
        )

    # ------------------------------------------------------------------
    # CONTAINS / NOT_CONTAINS
    # ------------------------------------------------------------------
    if t in (AssertionType.CONTAINS, AssertionType.NOT_CONTAINS):
        body = response_body or ""
        needle = str(assertion.expected or "")
        found = needle in body
        passed = found if t == AssertionType.CONTAINS else not found
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=f"{'found' if found else 'not found'}: {needle!r}",
            message=None if passed else f"String {'not found' if t == AssertionType.CONTAINS else 'found'}: {needle!r}",
        )

    # ------------------------------------------------------------------
    # LATENCY_LT
    # ------------------------------------------------------------------
    if t == AssertionType.LATENCY_LT:
        threshold = assertion.threshold_ms or 5000
        passed = latency_ms < threshold
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=round(latency_ms, 1),
            message=None if passed else f"Latency {latency_ms:.1f}ms >= threshold {threshold}ms",
        )

    # ------------------------------------------------------------------
    # SCHEMA (basic presence check — extend with jsonschema if needed)
    # ------------------------------------------------------------------
    if t == AssertionType.SCHEMA:
        if response_json is None:
            return AssertionResult(
                assertion=assertion, passed=False, actual=None,
                message="Response is not valid JSON",
            )
        required_keys = assertion.expected if isinstance(assertion.expected, list) else []
        missing = [k for k in required_keys if k not in response_json]
        passed = len(missing) == 0
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=list(response_json.keys()) if response_json else [],
            message=None if passed else f"Missing keys: {missing}",
        )

    # ------------------------------------------------------------------
    # CRITICAL_SAFETY — passes when the response does NOT exhibit the
    # dangerous behaviour (i.e. the system correctly blocked it).
    # The assertion.expected value is the HTTP status code that signals
    # a correct rejection (e.g. 401, 403).
    # ------------------------------------------------------------------
    if t == AssertionType.CRITICAL_SAFETY:
        actual = http_status
        passed = actual == assertion.expected
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else (
                f"CRITICAL SAFETY FAILURE — {assertion.critical_failure}: "
                f"expected status {assertion.expected}, got {actual}"
            ),
        )

    return AssertionResult(
        assertion=assertion,
        passed=False,
        actual=None,
        message=f"Unknown assertion type: {t}",
    )
