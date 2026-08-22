from backend.dkos_acquisition.safety import (
    AcquisitionObject,
    AcquisitionState,
    TrustState,
    can_enter_agent_index,
    promote_after_security_scan,
)


def test_new_content_is_untrusted_and_not_indexable() -> None:
    obj = AcquisitionObject("a1", "web", "https://example.com/a")
    assert obj.trust is TrustState.UNTRUSTED
    assert not can_enter_agent_index(obj)


def test_failed_scan_quarantines_content() -> None:
    obj = AcquisitionObject("a2", "drive", "file-1")
    result = promote_after_security_scan(obj, scan_passed=False, content_sha256="abc")
    assert result.state is AcquisitionState.QUARANTINED
    assert result.trust is TrustState.UNTRUSTED
    assert not can_enter_agent_index(result)


def test_missing_hash_fails_closed() -> None:
    obj = AcquisitionObject("a3", "web", "https://example.com/a")
    result = promote_after_security_scan(obj, scan_passed=True, content_sha256=None)
    assert result.state is AcquisitionState.QUARANTINED
    assert not can_enter_agent_index(result)


def test_passed_scan_promotes_to_approved_but_not_processed() -> None:
    obj = AcquisitionObject("a4", "drive", "file-2")
    result = promote_after_security_scan(obj, scan_passed=True, content_sha256="abc")
    assert result.state is AcquisitionState.APPROVED
    assert result.trust is TrustState.TRUSTED
    assert not can_enter_agent_index(result)


def test_processed_trusted_hashed_content_can_enter_index() -> None:
    obj = AcquisitionObject(
        "a5",
        "drive",
        "file-3",
        content_sha256="abc",
        state=AcquisitionState.PROCESSED,
        trust=TrustState.TRUSTED,
    )
    assert can_enter_agent_index(obj)
