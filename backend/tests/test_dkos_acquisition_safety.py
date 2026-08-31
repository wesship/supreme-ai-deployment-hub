import pytest

from backend.dkos_acquisition.safety import (
    AcquisitionObject,
    AcquisitionState,
    TrustState,
    can_enter_agent_index,
    promote_after_security_scan,
    transition,
)

SHA256 = "a" * 64


def scanning_object(acquisition_id: str = "a1") -> AcquisitionObject:
    return AcquisitionObject(
        acquisition_id,
        "web",
        "https://example.com/source",
        state=AcquisitionState.SCANNING,
    )


def test_new_content_is_untrusted_and_not_indexable() -> None:
    obj = AcquisitionObject("a1", "web", "https://example.com/a")

    assert obj.trust is TrustState.UNTRUSTED
    assert not can_enter_agent_index(obj)


@pytest.mark.parametrize("value", ["", " ", "not-a-sha256", "A" * 64])
def test_acquisition_object_rejects_invalid_identity_or_hash(value: str) -> None:
    kwargs = {"content_sha256": value} if value.strip() else {}

    with pytest.raises(ValueError):
        AcquisitionObject(value, "web", "source", **kwargs)


def test_security_result_requires_scanning_state() -> None:
    obj = AcquisitionObject("a2", "drive", "file-1")

    with pytest.raises(ValueError, match="only while scanning"):
        promote_after_security_scan(obj, scan_passed=True, content_sha256=SHA256)


@pytest.mark.parametrize(
    ("scan_passed", "digest"),
    [(False, SHA256), (True, None), (True, "malformed")],
)
def test_failed_or_ambiguous_scan_quarantines(
    scan_passed: bool, digest: str | None
) -> None:
    result = promote_after_security_scan(
        scanning_object(),
        scan_passed=scan_passed,
        content_sha256=digest,
    )

    assert result.state is AcquisitionState.QUARANTINED
    assert result.trust is TrustState.UNTRUSTED
    assert not can_enter_agent_index(result)


def test_passed_scan_approves_but_does_not_index() -> None:
    result = promote_after_security_scan(
        scanning_object(),
        scan_passed=True,
        content_sha256=SHA256,
    )

    assert result.state is AcquisitionState.APPROVED
    assert result.trust is TrustState.TRUSTED
    assert result.content_sha256 == SHA256
    assert not can_enter_agent_index(result)


def test_invalid_lifecycle_skip_is_rejected() -> None:
    obj = AcquisitionObject("a3", "web", "https://example.com/a")

    with pytest.raises(ValueError, match="invalid acquisition transition"):
        transition(obj, AcquisitionState.INDEXED)


def test_only_processed_trusted_hashed_content_can_enter_index() -> None:
    approved = promote_after_security_scan(
        scanning_object(),
        scan_passed=True,
        content_sha256=SHA256,
    )
    processed = transition(approved, AcquisitionState.PROCESSED)

    assert can_enter_agent_index(processed)


def test_quarantine_is_terminal_and_untrusted() -> None:
    quarantined = promote_after_security_scan(
        scanning_object(),
        scan_passed=False,
        content_sha256=SHA256,
    )

    with pytest.raises(ValueError, match="invalid acquisition transition"):
        transition(quarantined, AcquisitionState.APPROVED)
