from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.app.security import guardian_router as guardian
from backend.client_ai.auth import ClientAIPrincipal


class FakeTable:
    def __init__(self, db, name):
        self.db = db
        self.name = name
        self.mode = "select"
        self.payload = None
        self.filters = []
        self.limit_value = None
        self.order_field = None
        self.order_desc = False

    def select(self, *_args):
        self.mode = "select"
        return self

    def insert(self, payload):
        self.mode = "insert"
        self.payload = dict(payload)
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def order(self, field, desc=False):
        self.order_field = field
        self.order_desc = desc
        return self

    def execute(self):
        rows = self.db.rows.setdefault(self.name, [])
        if self.mode == "insert":
            row = dict(self.payload)
            row.setdefault("id", f"{self.name}-{self.db.counter}")
            self.db.counter += 1
            row.setdefault("created_at", f"2026-10-03T16:00:{self.db.counter:02d}+00:00")
            rows.append(row)
            return SimpleNamespace(data=[row])

        matches = [row for row in rows if all(row.get(key) == value for key, value in self.filters)]
        if self.order_field:
            matches = sorted(matches, key=lambda row: row.get(self.order_field, ""), reverse=self.order_desc)
        if self.limit_value is not None:
            matches = matches[: self.limit_value]
        if self.mode == "delete":
            for row in list(matches):
                rows.remove(row)
            return SimpleNamespace(data=matches)
        return SimpleNamespace(data=[dict(row) for row in matches])


class FakeDB:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.counter = 1

    def table(self, name):
        return FakeTable(self, name)


def principal(user_id="user-a", email="owner@example.com"):
    return ClientAIPrincipal(user_id=user_id, email=email)


def seeded_db(role="owner", organization_id="org-a", user_id="user-a"):
    return FakeDB(
        {
            "security_guardian_organizations": [
                {"id": organization_id, "name": "Pilot", "slug": "pilot-org", "status": "pilot"}
            ],
            "security_guardian_memberships": [
                {"organization_id": organization_id, "user_id": user_id, "role": role, "status": "active"}
            ],
            "security_guardian_events": [],
            "security_guardian_pilot_certifications": [],
        }
    )


def test_guardian_routes_require_authentication():
    app = FastAPI()
    app.include_router(guardian.router)
    response = TestClient(app).get("/api/security/guardian/organizations")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cross_tenant_overview_fails_closed(monkeypatch):
    db = seeded_db(organization_id="org-a")
    monkeypatch.setattr(guardian, "get_db", lambda: db)

    with pytest.raises(HTTPException) as exc:
        await guardian.organization_overview("org-b", principal())

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_event_organization_is_server_bound(monkeypatch):
    db = seeded_db()
    monkeypatch.setattr(guardian, "get_db", lambda: db)
    body = guardian.GuardianEventCreate(
        event_type="authentication.login",
        severity="high",
        source="test",
        ip_address="203.0.113.7",
        metadata={"attempt": 1},
    )

    result = await guardian.ingest_client_event("org-a", body, principal())

    assert result["event"]["organization_id"] == "org-a"
    assert db.rows["security_guardian_events"][0]["organization_id"] == "org-a"
    assert db.rows["security_guardian_events"][0]["created_by"] == "user-a"


@pytest.mark.asyncio
async def test_pilot_certification_is_blocked_without_explicit_pilot_enablement(monkeypatch):
    db = seeded_db()
    monkeypatch.setattr(guardian, "get_db", lambda: db)
    monkeypatch.delenv("SECURITY_GUARDIAN_PILOT_MODE", raising=False)
    monkeypatch.setenv("SECURITY_GUARDIAN_AUTOMATION_MODE", "monitor_only")

    await guardian.simulate_account_takeover("org-a", principal())
    result = await guardian.certify_pilot("org-a", principal())

    cert = result["certification"]
    assert cert["status"] == "blocked"
    assert "pilot_mode_enabled" in cert["blockers"]


@pytest.mark.asyncio
async def test_pilot_certification_passes_only_after_safe_simulation(monkeypatch):
    db = seeded_db()
    monkeypatch.setattr(guardian, "get_db", lambda: db)
    monkeypatch.setenv("SECURITY_GUARDIAN_PILOT_MODE", "true")
    monkeypatch.setenv("SECURITY_GUARDIAN_AUTOMATION_MODE", "approval_only")

    simulation = await guardian.simulate_account_takeover("org-a", principal())
    result = await guardian.certify_pilot("org-a", principal())

    cert = result["certification"]
    assert simulation["non_executing"] is True
    assert simulation["events_created"] == 5
    assert cert["status"] == "certified"
    assert cert["score"] == 100
    assert cert["blockers"] == []
    assert len(cert["evidence_hash"]) == 64
    assert result["automation_mode"] == "approval_only"


@pytest.mark.asyncio
async def test_viewer_cannot_run_pilot_simulation(monkeypatch):
    db = seeded_db(role="viewer")
    monkeypatch.setattr(guardian, "get_db", lambda: db)

    with pytest.raises(HTTPException) as exc:
        await guardian.simulate_account_takeover("org-a", principal())

    assert exc.value.status_code == 403


def test_main_registers_guardian_as_required_router():
    source = open("backend/main.py", encoding="utf-8").read()
    assert '"backend.app.security.guardian_router"' in source
    assert '"/api/security/guardian/organizations": "get"' in source
