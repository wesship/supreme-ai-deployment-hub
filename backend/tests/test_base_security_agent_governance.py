from __future__ import annotations

from backend.app.security.agents.base import BaseSecurityAgent


def test_destructive_action_is_downgraded_to_pending_approval():
    actions = [{
        "action": "revoke_token",
        "status": "success",
        "result": "success",
        "actor": "user-1",
    }]

    governed = BaseSecurityAgent._govern_actions(actions)

    assert governed == [{
        "action": "revoke_token",
        "status": "pending_approval",
        "actor": "user-1",
        "automated": False,
        "requires_approval": True,
        "governance_reason": "High-impact containment requires explicit approval and an audited executor.",
    }]


def test_destructive_action_type_alias_is_governed():
    actions = [{
        "action_type": "block_ip",
        "status": "blocked",
        "ip": "203.0.113.10",
    }]

    governed = BaseSecurityAgent._govern_actions(actions)

    assert governed[0]["status"] == "pending_approval"
    assert governed[0]["automated"] is False
    assert governed[0]["requires_approval"] is True


def test_internal_bookkeeping_action_is_preserved():
    actions = [{
        "action": "update_risk_score",
        "status": "success",
        "actor": "user-1",
    }]

    governed = BaseSecurityAgent._govern_actions(actions)

    assert governed == actions
    assert governed is not actions
    assert governed[0] is not actions[0]


def test_non_destructive_recommendation_is_preserved():
    actions = [{
        "action": "escalate_incident",
        "status": "recommended",
        "reason": "critical finding",
    }]

    governed = BaseSecurityAgent._govern_actions(actions)

    assert governed == actions


def test_empty_action_list_is_safe():
    assert BaseSecurityAgent._govern_actions([]) == []
