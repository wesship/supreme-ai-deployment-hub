from backend.ai_films.policy_change_request import build_policy_change_request


def test_policy_change_request_baseline_and_review_state():
    request = build_policy_change_request(
        approval={"id": "a1", "decision": "approved", "evidenceHash": "h1"},
        recommendation={"key": "k1", "provider": "pollo", "styleId": None, "action": "hold", "proposedAdjustment": 0},
        rollback_plan="restore prior preference",
    )
    assert request.required_canary_state == "not_required"
    assert request.second_review_required is True
    assert request.status == "pending_second_review"


def test_policy_change_request_nonbaseline_requires_canary():
    request = build_policy_change_request(
        approval={"id": "a2", "decision": "approved", "evidenceHash": "h2"},
        recommendation={"key": "k2", "provider": "replicate", "styleId": "cinematic-storyboard", "action": "increase_preference", "proposedAdjustment": 5},
        rollback_plan="restore prior preference",
    )
    assert request.required_canary_provider == "replicate"
    assert request.required_canary_state == "pass_required"
