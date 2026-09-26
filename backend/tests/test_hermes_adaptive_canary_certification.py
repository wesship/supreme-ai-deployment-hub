import pytest
from pydantic import ValidationError

from backend.occ_operator.hermes_router import (
    AdaptiveCanaryCertificationRequest,
    AdaptiveCanaryMetrics,
)


def test_adaptive_canary_metrics_accept_bounded_rates_and_nonnegative_cost_latency():
    metrics = AdaptiveCanaryMetrics(
        success_rate=0.98,
        error_rate=0.02,
        latency_ms=1200,
        cost_usd=0.04,
    )
    assert metrics.success_rate == 0.98
    assert metrics.cost_usd == 0.04


@pytest.mark.parametrize(
    "field,value",
    [
        ("success_rate", 1.01),
        ("error_rate", -0.01),
        ("latency_ms", -1),
        ("cost_usd", -0.001),
    ],
)
def test_adaptive_canary_metrics_reject_invalid_values(field, value):
    payload = {
        "success_rate": 0.98,
        "error_rate": 0.02,
        "latency_ms": 1200,
        "cost_usd": 0.04,
    }
    payload[field] = value
    with pytest.raises(ValidationError):
        AdaptiveCanaryMetrics(**payload)


def test_certification_request_requires_baseline_and_candidate():
    request = AdaptiveCanaryCertificationRequest(
        baseline={"success_rate": 0.98, "error_rate": 0.02, "latency_ms": 1000, "cost_usd": 0.01},
        candidate={"success_rate": 0.99, "error_rate": 0.01, "latency_ms": 950, "cost_usd": 0.009},
    )
    assert request.candidate.success_rate > request.baseline.success_rate
