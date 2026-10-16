"""Fail-closed authorization binding for a future Hermes dispatcher.

This module never authenticates a user itself. The caller must supply a trusted
verifier that checks a signed/persisted approval using the existing identity system.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime
from hashlib import sha256
import json

from factory.safety import FactorySafetyError, require_approval


def scope_fingerprint(*, issue_id: str, repository: str, commit_sha: str, operation: str) -> str:
    """Canonical digest of the exact requested action, independent of dict ordering."""
    fields = (issue_id, repository, commit_sha, operation)
    if not all(isinstance(value, str) and value.strip() for value in fields):
        raise FactorySafetyError("incomplete approval scope")
    payload = dict(zip(("issue_id", "repository", "commit_sha", "operation"), fields))
    return sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def authorize_dispatch(
    approval: Mapping[str, object],
    *,
    issue_id: str,
    repository: str,
    commit_sha: str,
    operation: str,
    trusted_verifier: Callable[[Mapping[str, object]], bool],
    now: datetime | None = None,
) -> None:
    """Reject all work unless scope, expiry and trusted approval proof agree.

    The trusted_verifier must consult the authoritative approval store/identity
    provider, not trust caller-controlled record fields. No dispatch happens here.
    """
    if not isinstance(approval, Mapping):
        raise FactorySafetyError("missing approval record")
    expected = scope_fingerprint(
        issue_id=issue_id, repository=repository,
        commit_sha=commit_sha, operation=operation,
    )
    if approval.get("scope_fingerprint") != expected:
        raise FactorySafetyError("approval scope mismatch")
    require_approval(approval, issue_id=issue_id, now=now)
    if not callable(trusted_verifier):
        raise FactorySafetyError("trusted verifier missing")
    try:
        verified = trusted_verifier(approval)
    except Exception as exc:
        raise FactorySafetyError("trusted verification unavailable") from exc
    if verified is not True:
        raise FactorySafetyError("approval proof not verified")
