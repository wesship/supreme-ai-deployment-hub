"""Fail-closed trust-state policy for DKOS acquisition objects.

This module is deliberately side-effect free. It defines which acquired objects may
cross from isolated staging into agent-facing processing and indexes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class AcquisitionState(StrEnum):
    DISCOVERED = "discovered"
    SELECTED = "selected"
    QUEUED = "queued"
    ACQUIRED = "acquired"
    SCANNING = "scanning"
    QUARANTINED = "quarantined"
    APPROVED = "approved"
    PROCESSED = "processed"
    INDEXED = "indexed"


class TrustState(StrEnum):
    UNTRUSTED = "untrusted"
    TRUSTED = "trusted"


_ALLOWED_TRANSITIONS: dict[AcquisitionState, frozenset[AcquisitionState]] = {
    AcquisitionState.DISCOVERED: frozenset({AcquisitionState.SELECTED}),
    AcquisitionState.SELECTED: frozenset({AcquisitionState.QUEUED}),
    AcquisitionState.QUEUED: frozenset({AcquisitionState.ACQUIRED}),
    AcquisitionState.ACQUIRED: frozenset(
        {AcquisitionState.SCANNING, AcquisitionState.QUARANTINED}
    ),
    AcquisitionState.SCANNING: frozenset(
        {AcquisitionState.APPROVED, AcquisitionState.QUARANTINED}
    ),
    AcquisitionState.QUARANTINED: frozenset(),
    AcquisitionState.APPROVED: frozenset({AcquisitionState.PROCESSED}),
    AcquisitionState.PROCESSED: frozenset({AcquisitionState.INDEXED}),
    AcquisitionState.INDEXED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class AcquisitionObject:
    acquisition_id: str
    source_type: str
    source_object_id: str
    content_sha256: str | None = None
    state: AcquisitionState = AcquisitionState.DISCOVERED
    trust: TrustState = TrustState.UNTRUSTED

    def __post_init__(self) -> None:
        for field_name in ("acquisition_id", "source_type", "source_object_id"):
            value = getattr(self, field_name)
            if not value or not value.strip():
                raise ValueError(f"{field_name} must be non-empty")
        if self.content_sha256 is not None and not _SHA256_RE.fullmatch(
            self.content_sha256
        ):
            raise ValueError("content_sha256 must be a lowercase SHA-256 digest")


def can_enter_agent_index(obj: AcquisitionObject) -> bool:
    """Return whether an object may cross into an agent-facing index."""

    return (
        obj.state in {AcquisitionState.PROCESSED, AcquisitionState.INDEXED}
        and obj.trust is TrustState.TRUSTED
        and obj.content_sha256 is not None
    )


def transition(
    obj: AcquisitionObject,
    target: AcquisitionState,
    *,
    trust: TrustState | None = None,
    content_sha256: str | None = None,
) -> AcquisitionObject:
    """Create the next state while rejecting skips and unsafe promotions."""

    if target not in _ALLOWED_TRANSITIONS[obj.state]:
        raise ValueError(f"invalid acquisition transition: {obj.state} -> {target}")

    next_trust = obj.trust if trust is None else trust
    next_hash = obj.content_sha256 if content_sha256 is None else content_sha256

    if target is AcquisitionState.QUARANTINED:
        next_trust = TrustState.UNTRUSTED
    if target in {AcquisitionState.PROCESSED, AcquisitionState.INDEXED} and (
        next_trust is not TrustState.TRUSTED or next_hash is None
    ):
        raise ValueError("processed and indexed content must be trusted and hashed")

    return AcquisitionObject(
        acquisition_id=obj.acquisition_id,
        source_type=obj.source_type,
        source_object_id=obj.source_object_id,
        content_sha256=next_hash,
        state=target,
        trust=next_trust,
    )


def promote_after_security_scan(
    obj: AcquisitionObject,
    *,
    scan_passed: bool,
    content_sha256: str | None,
) -> AcquisitionObject:
    """Approve a scanned object or quarantine it; ambiguity fails closed."""

    if obj.state is not AcquisitionState.SCANNING:
        raise ValueError("security results are accepted only while scanning")

    if not scan_passed or content_sha256 is None:
        return transition(
            obj,
            AcquisitionState.QUARANTINED,
            content_sha256=content_sha256,
        )

    return transition(
        obj,
        AcquisitionState.APPROVED,
        trust=TrustState.TRUSTED,
        content_sha256=content_sha256,
    )
