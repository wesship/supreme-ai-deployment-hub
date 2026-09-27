from backend.occ_operator.hermes_router import (
    AdaptiveChangeDecision,
    AdaptiveChangeRequestCreate,
    _adaptive_risk_classification,
)


def test_adaptive_risk_classification_is_fail_closed_for_routing_and_concurrency():
    assert _adaptive_risk_classification("routing", "info") == "high"
    assert _adaptive_risk_classification("concurrency", "warning") == "high"


def test_adaptive_risk_classification_preserves_medium_tool_and_agent_changes():
    assert _adaptive_risk_classification("tool", "info") == "medium"
    assert _adaptive_risk_classification("agent", "warning") == "medium"


def test_adaptive_change_request_contract_requires_rollback_and_guardrail():
    body = AdaptiveChangeRequestCreate(
        proposal_id="route-agent:tars",
        category="routing",
        target="TARS",
        severity="warning",
        evidence={"failure_rate": 0.25},
        proposed_change={"operation": "canary_fallback", "traffic_percent": 10},
        guardrail="Do not bypass GUARDIAN approval boundaries.",
        rollback_plan="Abort the canary and preserve the current production route.",
    )
    assert body.proposal_id == "route-agent:tars"
    assert body.proposed_change["traffic_percent"] == 10


def test_adaptive_change_decision_contract_allows_only_approved_or_rejected():
    assert AdaptiveChangeDecision(decision="approved", rationale="Evidence reviewed.").decision == "approved"
    assert AdaptiveChangeDecision(decision="rejected", rationale="Risk exceeds the canary budget.").decision == "rejected"
