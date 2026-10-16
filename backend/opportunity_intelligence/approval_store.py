"""Persistent, tenant-scoped REA approvals; admission only, never execution."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .rea_adapter import REAAdmissionError, REAApproval, REARequest, REAAdmission, admit_rea_job


class ApprovalStore:
    """Local SQLite prototype. Production requires managed storage and audited access."""

    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        with self._connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS rea_approvals (
                approval_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                artifact_sha256 TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                approved INTEGER NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            )""")
            db.execute("""CREATE TABLE IF NOT EXISTS rea_admission_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                artifact_sha256 TEXT NOT NULL,
                outcome TEXT NOT NULL
            )""")

    def _connect(self):
        return sqlite3.connect(self.database_path)

    def save(self, approval: REAApproval) -> None:
        if not approval.approval_id.strip() or approval.expires_at.tzinfo is None:
            raise ValueError("Valid approval ID and timezone-aware expiration required")
        with self._connect() as db:
            db.execute("""INSERT INTO rea_approvals
                (approval_id, tenant_id, requester_id, artifact_sha256, expires_at, approved)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (approval.approval_id, approval.tenant_id, approval.requester_id,
                      approval.artifact_sha256, approval.expires_at.isoformat(), int(approval.approved)))

    def revoke(self, approval_id: str, tenant_id: str) -> bool:
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE rea_approvals SET revoked = 1 WHERE approval_id = ? AND tenant_id = ?",
                (approval_id, tenant_id),
            )
            return cursor.rowcount == 1

    def admit(self, request: REARequest, approval_id: str, *, now: datetime | None = None) -> REAAdmission:
        current = now or datetime.now(timezone.utc)
        with self._connect() as db:
            row = db.execute("""SELECT tenant_id, requester_id, artifact_sha256,
                expires_at, approved, revoked FROM rea_approvals
                WHERE approval_id = ? AND tenant_id = ?""",
                (approval_id, request.tenant_id)).fetchone()
            approval = None
            revoked = frozenset()
            if row is not None:
                approval = REAApproval(row[0], row[1], row[2],
                                       datetime.fromisoformat(row[3]), bool(row[4]), approval_id)
                if row[5]:
                    revoked = frozenset({approval_id})
            try:
                result = admit_rea_job(request, approval, now=current, revoked_approval_ids=revoked)
            except REAAdmissionError:
                outcome = "denied"
                result = None
            else:
                outcome = "admitted"
            db.execute("""INSERT INTO rea_admission_audit
                (recorded_at, tenant_id, requester_id, artifact_sha256, outcome)
                VALUES (?, ?, ?, ?, ?)""",
                (current.isoformat(), request.tenant_id, request.requester_id,
                 request.artifact_sha256, outcome))
        if result is None:
            raise REAAdmissionError("REA admission denied")
        return result
