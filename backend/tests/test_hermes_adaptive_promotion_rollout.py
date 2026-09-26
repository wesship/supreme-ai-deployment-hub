import pytest
from pydantic import ValidationError

from backend.occ_operator.hermes_router import AdaptivePromotionDecision, AdaptiveRolloutRequest


def test_promotion_decision_contract():
    approved = AdaptivePromotionDecision(decision="approved", rationale="Canary passed and rollback is ready.")
    assert approved.decision == "approved"


def test_rollout_request_accepts_staging_without_production_authorization():
    body = AdaptiveRolloutRequest(environment="staging", pre_change_config={"runtime_changed": False})
    assert body.production_authorization is None


def test_rollout_request_rejects_unknown_environment():
    with pytest.raises(ValidationError):
        AdaptiveRolloutRequest(environment="sandbox")


def test_production_authorization_length_is_bounded_but_presence_is_endpoint_guarded():
    body = AdaptiveRolloutRequest(environment="production", production_authorization="x" * 16)
    assert len(body.production_authorization or "") == 16
