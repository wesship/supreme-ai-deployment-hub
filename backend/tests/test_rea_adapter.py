"""Admission tests: REA is never executed."""
from datetime import datetime, timedelta, timezone

import pytest

from backend.opportunity_intelligence.rea_adapter import (
    REAAdmissionError, REAApproval, REARequest, admit_rea_job,
)

NOW = datetime(2026, 10, 15, tzinfo=timezone.utc)
DIGEST = "a" * 64


def sample():
    req = REARequest("tenant-a", "operator-a", DIGEST, "authorized research")
    approval = REAApproval("tenant-a", "operator-a", DIGEST, NOW + timedelta(minutes=5), True, "approval-123")
    return req, approval


@pytest.mark.parametrize("flag", [None, "", "TRUE", "1", "false"])
def test_disabled_fail_closed(monkeypatch, flag):
    if flag is None:
        monkeypatch.delenv("OPPORTUNITY_REA_ENABLED", raising=False)
    else:
        monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", flag)
    with pytest.raises(REAAdmissionError, match="disabled"):
        admit_rea_job(*sample(), now=NOW, revoked_approval_ids=frozenset())


def test_valid_admission_does_not_execute(monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    assert admit_rea_job(*sample(), now=NOW, revoked_approval_ids=frozenset()).status == "approved_for_isolated_worker"


@pytest.mark.parametrize("change", ["tenant", "requester", "digest", "expired", "unapproved"])
def test_scope_and_expiry(monkeypatch, change):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    req, approval = sample()
    values = dict(approval.__dict__)
    if change == "tenant":
        values["tenant_id"] = "other"
    elif change == "requester":
        values["requester_id"] = "other"
    elif change == "digest":
        values["artifact_sha256"] = "b" * 64
    elif change == "expired":
        values["expires_at"] = NOW
    else:
        values["approved"] = False
    with pytest.raises(REAAdmissionError):
        admit_rea_job(req, REAApproval(**values), now=NOW, revoked_approval_ids=frozenset())


def test_missing_approval(monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    with pytest.raises(REAAdmissionError):
        admit_rea_job(sample()[0], None, now=NOW, revoked_approval_ids=frozenset())

def test_revoked_approval_rejected(monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    with pytest.raises(REAAdmissionError, match="revoked"):
        admit_rea_job(*sample(), now=NOW, revoked_approval_ids=frozenset({"approval-123"}))


def test_missing_revocation_state_rejected(monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    with pytest.raises(REAAdmissionError, match="Revocation state unavailable"):
        admit_rea_job(*sample(), now=NOW)
