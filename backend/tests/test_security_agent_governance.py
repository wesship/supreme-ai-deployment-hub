from types import SimpleNamespace

import pytest

from backend.app.security.agent import (
    AGENT_VERSION,
    DESTRUCTIVE_ACTIONS,
    _determine_action,
    handle_alert,
)


class FakeTable:
    def __init__(self):
        self.inserted = None

    def insert(self, payload):
        self.inserted = payload
        return self

    def execute(self):
        return SimpleNamespace(data=[self.inserted])


class FakeSupabase:
    def __init__(self):
        self.table_instance = FakeTable()

    def table(self, name):
        assert name == "hermes_security_actions"
        return self.table_instance


@pytest.mark.asyncio
async def test_destructive_action_requires_approval_and_is_not_marked_success():
    db = FakeSupabase()
    result = await handle_alert(
        db,
        {
            "id": "alert-1",
            "rule_id": "token_reuse",
            "severity": "critical",
            "actor": "user-1",
        },
    )

    assert result["action_type"] == "revoke_token"
    assert result["action_type"] in DESTRUCTIVE_ACTIONS
    assert result["result"] == "pending_approval"
    assert result["parameters"]["requires_approval"] is True
    assert result["parameters"]["automated"] is False
    assert result["agent_version"] == AGENT_VERSION


@pytest.mark.asyncio
async def test_non_destructive_action_is_recommendation_not_execution():
    db = FakeSupabase()
    result = await handle_alert(
        db,
        {
            "id": "alert-2",
            "rule_id": "admin_privilege_escalation",
            "severity": "critical",
        },
    )

    assert result["action_type"] == "notify_admin"
    assert result["result"] == "recommended"
    assert result["parameters"]["requires_approval"] is False
    assert result["parameters"]["automated"] is False


@pytest.mark.asyncio
async def test_medium_severity_does_not_create_action_record():
    db = FakeSupabase()
    result = await handle_alert(
        db,
        {"id": "alert-3", "rule_id": "api_abuse", "severity": "medium"},
    )

    assert result is None
    assert db.table_instance.inserted is None


def test_response_policy_uses_minimum_necessary_action():
    assert _determine_action("token_reuse", "critical") == "revoke_token"
    assert _determine_action("brute_force_login", "high") == "block_ip"
    assert _determine_action("unknown", "critical") == "notify_admin"
    assert _determine_action("unknown", "low") is None
