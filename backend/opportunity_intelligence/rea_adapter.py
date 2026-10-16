"""Fail-closed REA job admission. No external process or network execution."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

_DIGEST = re.compile(r"^[a-f0-9]{64}$")


class REAAdmissionError(ValueError):
    """A job failed the security admission gate."""


@dataclass(frozen=True)
class REARequest:
    tenant_id: str
    requester_id: str
    artifact_sha256: str
    purpose: str


@dataclass(frozen=True)
class REAApproval:
    tenant_id: str
    requester_id: str
    artifact_sha256: str
    expires_at: datetime
    approved: bool


@dataclass(frozen=True)
class REAAdmission:
    status: Literal["approved_for_isolated_worker"]
    artifact_sha256: str


def admit_rea_job(request: REARequest, approval: REAApproval | None, *, now: datetime | None = None) -> REAAdmission:
    """Validate admission only; never starts a worker."""
    if os.getenv("OPPORTUNITY_REA_ENABLED") != "true":
        raise REAAdmissionError("REA is disabled")
    if not request.tenant_id.strip() or not request.requester_id.strip() or not request.purpose.strip():
        raise REAAdmissionError("Missing request scope")
    if not _DIGEST.fullmatch(request.artifact_sha256):
        raise REAAdmissionError("Invalid artifact digest")
    if approval is None or not approval.approved:
        raise REAAdmissionError("Approval required")
    if (request.tenant_id, request.requester_id, request.artifact_sha256) != (
        approval.tenant_id, approval.requester_id, approval.artifact_sha256
    ):
        raise REAAdmissionError("Approval scope mismatch")
    if approval.expires_at.tzinfo is None:
        raise REAAdmissionError("Approval expiry must be timezone-aware")
    current = now if now is not None else datetime.now(timezone.utc)
    if current.tzinfo is None or approval.expires_at <= current:
        raise REAAdmissionError("Approval expired")
    return REAAdmission(status="approved_for_isolated_worker", artifact_sha256=request.artifact_sha256)
