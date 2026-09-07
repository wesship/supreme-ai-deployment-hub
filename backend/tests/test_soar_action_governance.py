from __future__ import annotations

import pytest

from backend.app.security.action_governance import classify_security_action
from backend.app.security.soar import SOAREngine


class _Table:
    def __init__(self):
        self.rows = []

    def insert(self, row):
        self.rows.append(row)
        return self

    def update(self, row):
        self.rows.append(row)
        return self

    def eq(self, *args, **kwargs):
        return self

    def execute(self):
        return type("Resp", (), {"data": self.rows})()


class _DB:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        return self.tables.setdefault(name, _Table())


def test_destructive_action_requires_approval():
    decision = classify_security_action("revoke_jwt", implemented=True)
    assert decision.requires_approval is True
    assert decision.executable is False
    assert decision.status == "pending_approval"


def test_unknown_action_is_fail_closed():
    decision = classify_security_action("launch_magic_containment", implemented=False)
    assert decision.executable is False
    assert decision.status == "not_executed"


@pytest.mark.asyncio
async def test_soar_destructive_stub_never_reports_success():
    engine = SOAREngine(_DB())
    result = await engine._execute_step(
        {"action": "block_ip", "params": {"duration": "1h"}},
        {"id": "alert-1", "ip": "203.0.113.10"},
        1,
    )
    assert result["status"] == "pending_approval"


@pytest.mark.asyncio
async def test_soar_unknown_action_never_reports_success():
    engine = SOAREngine(_DB())
    result = await engine._execute_step(
        {"action": "unknown_action", "params": {}},
        {"id": "alert-2"},
        1,
    )
    assert result["status"] == "not_executed"


@pytest.mark.asyncio
async def test_create_incident_is_the_only_current_success_path():
    db = _DB()
    engine = SOAREngine(db)
    result = await engine._execute_step(
        {"action": "create_incident", "params": {"severity": "high"}},
        {"id": "alert-3", "rule_id": "api_abuse", "severity": "high"},
        1,
    )
    assert result["status"] == "success"
    assert db.table("security_incidents").rows


@pytest.mark.asyncio
async def test_playbook_with_destructive_step_stays_pending_approval():
    db = _DB()
    engine = SOAREngine(db)
    result = await engine._execute_playbook(
        {
            "id": "pb-1",
            "name": "Contain account",
            "steps": [
                {"action": "create_incident", "params": {}},
                {"action": "disable_account", "params": {}},
            ],
            "execution_count": 0,
        },
        {"id": "alert-4", "actor": "user-1", "severity": "critical"},
    )
    assert result["status"] == "pending_approval"
    assert result["steps_succeeded"] == 1
    assert result["steps_pending_approval"] == 1
