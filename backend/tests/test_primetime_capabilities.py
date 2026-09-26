import pytest

from backend.app.routers.primetime_capabilities import authorize_capability


def test_unknown_capability_is_denied():
    with pytest.raises(PermissionError):
        authorize_capability(agent="primetime-scorer", capability="send_email")


def test_cross_agent_capability_is_denied():
    with pytest.raises(PermissionError):
        authorize_capability(agent="primetime-scorer", capability="research")


def test_approved_capability_is_allowed():
    policy = authorize_capability(agent="primetime-writer", capability="draft_outreach")
    assert policy.human_approval_required is True
    assert policy.side_effect is True
