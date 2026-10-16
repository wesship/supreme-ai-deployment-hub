from datetime import datetime, timedelta, timezone

import pytest

from backend.opportunity_intelligence.approval_store import ApprovalStore
from backend.opportunity_intelligence.rea_adapter import REAAdmissionError, REAApproval, REARequest

NOW = datetime(2026, 10, 15, tzinfo=timezone.utc)
DIGEST = "a" * 64


def test_persistent_approval_revocation_and_audit(tmp_path, monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    db_path = tmp_path / "rea.db"
    store = ApprovalStore(db_path)
    request = REARequest("tenant-a", "user-a", DIGEST, "authorized inspection")
    store.save(REAApproval("tenant-a", "user-a", DIGEST, NOW + timedelta(hours=1), True, "approval-1"))
    assert ApprovalStore(db_path).admit(request, "approval-1", now=NOW).status == "approved_for_isolated_worker"
    assert store.revoke("approval-1", "tenant-b") is False
    assert store.revoke("approval-1", "tenant-a") is True
    with pytest.raises(REAAdmissionError):
        ApprovalStore(db_path).admit(request, "approval-1", now=NOW)
    with store._connect() as db:
        assert db.execute("SELECT outcome FROM rea_admission_audit ORDER BY id").fetchall() == [
            ("admitted",), ("denied",)
        ]


def test_cross_tenant_denied_and_audited(tmp_path, monkeypatch):
    monkeypatch.setenv("OPPORTUNITY_REA_ENABLED", "true")
    store = ApprovalStore(tmp_path / "rea.db")
    store.save(REAApproval("tenant-a", "user-a", DIGEST, NOW + timedelta(hours=1), True, "approval-1"))
    with pytest.raises(REAAdmissionError):
        store.admit(REARequest("tenant-b", "user-a", DIGEST, "research"), "approval-1", now=NOW)
    with store._connect() as db:
        assert db.execute("SELECT tenant_id, outcome FROM rea_admission_audit").fetchone() == ("tenant-b", "denied")
