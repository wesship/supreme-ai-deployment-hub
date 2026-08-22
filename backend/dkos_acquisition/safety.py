"""Safety state helpers for universal DKOS acquisition.

The acquisition layer treats all newly retrieved content as untrusted until the
DKOS security pipeline explicitly promotes it. These helpers are intentionally
side-effect free so policy decisions can be tested independently.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


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


@dataclass(frozen=True)
class AcquisitionObject:
    acquisition_id: str
    source_type: str
    source_object_id: str
    content_sha256: str | None = None
    state: AcquisitionState = AcquisitionState.DISCOVERED
    trust: TrustState = TrustState.UNTRUSTED


def can_enter_agent_index(obj: AcquisitionObject) -> bool:
    """Only approved, processed content may enter an agent-facing index."""

    return (
        obj.state in {AcquisitionState.PROCESSED, AcquisitionState.INDEXED}
        and obj.trust is TrustState.TRUSTED
        and bool(obj.content_sha256)
    )


def promote_after_security_scan(
    obj: AcquisitionObject,
    *,
    scan_passed: bool,
    content_sha256: str | None,
) -> AcquisitionObject:
    """Promote scanned content or quarantine it; fail closed on ambiguity."""

    if not scan_passed or not content_sha256:
        return AcquisitionObject(
            acquisition_id=obj.acquisition_id,
            source_type=obj.source_type,
            source_object_id=obj.source_object_id,
            content_sha256=content_sha256,
            state=AcquisitionState.QUARANTINED,
            trust=TrustState.UNTRUSTED,
        )

    return AcquisitionObject(
        acquisition_id=obj.acquisition_id,
        source_type=obj.source_type,
        source_object_id=obj.source_object_id,
        content_sha256=content_sha256,
        state=AcquisitionState.APPROVED,
        trust=TrustState.TRUSTED,
    )
