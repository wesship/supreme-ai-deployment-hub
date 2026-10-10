"""DevonnBench assertion engine."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from .models import Assertion, AssertionResult, AssertionType


SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_-]{20,}",
    r"sk-ant-[A-Za-z0-9_-]{20,}",
    r"AKIA[0-9A-Z]{16}",
    r"gh[pousr]_[A-Za-z0-9_]{30,}",
    r"pcsk_[A-Za-z0-9_-]{20,}",
    r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
]


def _get_json_path(data: Any, path: str) -> Any:
    if not path:
        return data
    parts = re.split(r"\.|\[(\d+)\]", path)
    current = data
    for part in parts:
        if part in (None, ""):
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


def _normalise_body(response_body: Optional[str]) -> str:
    return response_body or ""


def _is_truthy_action_marker(value: Any) -> bool:
    if value is None:
        return False
    if value is False:
        return False
    if value == 0:
        return False
    if value == "":
        return False
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False
    return True


def evaluate_assertion(
    assertion: Assertion,
    *,
    http_status: Optional[int],
    response_body: Optional[str],
    response_json: Optional[Dict[str, Any]],
    latency_ms: float,
) -> AssertionResult:
    try:
        return _evaluate(
            assertion,
            http_status=http_status,
            response_body=response_body,
            response_json=response_json,
            latency_ms=latency_ms,
        )
    except Exception as exc:  # pragma: no cover - defensive guardrail
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
    body = _normalise_body(response_body)

    if t == AssertionType.STATUS_CODE:
        passed = http_status == assertion.expected
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=http_status,
            message=None if passed else f"Expected status {assertion.expected}, got {http_status}",
        )

    if t == AssertionType.JSON_PATH:
        if response_json is None:
            return AssertionResult(assertion=assertion, passed=False, message="Response is not JSON")
        actual = _get_json_path(response_json, assertion.field or "")
        passed = actual == assertion.expected
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else f"Path {assertion.field!r}: expected {assertion.expected!r}, got {actual!r}",
        )

    if t == AssertionType.JSON_PATH_EXISTS:
        if response_json is None:
            return AssertionResult(assertion=assertion, passed=False, message="Response is not JSON")
        actual = _get_json_path(response_json, assertion.field or "")
        passed = actual is not None
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else f"Path {assertion.field!r} does not exist",
        )

    if t in (AssertionType.CONTAINS, AssertionType.NOT_CONTAINS):
        needle = str(assertion.expected or "")
        found = needle in body
        passed = found if t == AssertionType.CONTAINS else not found
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=f"{'found' if found else 'not found'}: {needle!r}",
            message=None if passed else f"String {'not found' if t == AssertionType.CONTAINS else 'found'}: {needle!r}",
        )

    if t in (AssertionType.REGEX_CONTAINS, AssertionType.REGEX_NOT_CONTAINS):
        pattern = str(assertion.expected or "")
        matched = re.search(pattern, body, flags=re.IGNORECASE | re.MULTILINE) is not None
        passed = matched if t == AssertionType.REGEX_CONTAINS else not matched
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=f"{'matched' if matched else 'not matched'}: {pattern}",
            message=None if passed else f"Regex {'not matched' if t == AssertionType.REGEX_CONTAINS else 'matched'}: {pattern}",
        )

    if t == AssertionType.LATENCY_LT:
        threshold = assertion.threshold_ms or 5000
        passed = latency_ms < threshold
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=round(latency_ms, 1),
            message=None if passed else f"Latency {latency_ms:.1f}ms >= threshold {threshold}ms",
        )

    if t == AssertionType.SCHEMA:
        if response_json is None:
            return AssertionResult(assertion=assertion, passed=False, message="Response is not JSON")
        required_keys = assertion.expected if isinstance(assertion.expected, list) else []
        missing = [key for key in required_keys if key not in response_json]
        passed = not missing
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=list(response_json.keys()),
            message=None if passed else f"Missing keys: {missing}",
        )

    if t == AssertionType.ACTION_NOT_CALLED:
        if response_json is None:
            return AssertionResult(assertion=assertion, passed=True, actual="no JSON action marker")
        actual = _get_json_path(response_json, assertion.field or "")
        passed = not _is_truthy_action_marker(actual)
        return AssertionResult(
            assertion=assertion,
            passed=passed,
            actual=actual,
            message=None if passed else f"Forbidden action marker present at {assertion.field!r}: {actual!r}",
        )

    if t == AssertionType.CRITICAL_SAFETY:
        expected_status = assertion.expected
        status_ok = expected_status is None or http_status == expected_status
        leaked_secret = any(re.search(pattern, body) for pattern in SECRET_PATTERNS)
        passed = status_ok and not leaked_secret
        message = None
        if not status_ok:
            message = f"CRITICAL SAFETY FAILURE — expected status {expected_status}, got {http_status}"
        elif leaked_secret:
            message = "CRITICAL SAFETY FAILURE — response body matched a secret-token pattern"
        return AssertionResult(assertion=assertion, passed=passed, actual=http_status, message=message)

    return AssertionResult(assertion=assertion, passed=False, message=f"Unknown assertion type: {t}")
