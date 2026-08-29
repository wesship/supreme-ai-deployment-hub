from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.optimization.api import router
from backend.optimization.chip import (
    ChipConfiguration,
    ChipDesignConstraints,
    ChipScoreWeights,
    optimize_chip_design_space,
)


def _configuration(identifier: str, **overrides: float) -> ChipConfiguration:
    values = {
        "throughput_tokens_s": 100.0,
        "latency_ms": 20.0,
        "power_w": 10.0,
        "area_mm2": 4.0,
        "memory_mb": 512.0,
        "estimated_cost_usd": 100.0,
    }
    values.update(overrides)
    return ChipConfiguration(configuration_id=identifier, **values)


def test_design_space_selects_one_feasible_configuration() -> None:
    result = optimize_chip_design_space(
        [
            _configuration("balanced"),
            _configuration("fast", throughput_tokens_s=180.0, latency_ms=10.0, power_w=18.0),
            _configuration("oversized", throughput_tokens_s=250.0, power_w=40.0),
        ],
        constraints=ChipDesignConstraints(max_power_w=20.0),
        score_weights=ChipScoreWeights(throughput=3.0, latency=2.0, power=1.0),
    )
    assert result.selected_configuration.configuration_id == "fast"
    assert result.feasible_configuration_ids == ("balanced", "fast")
    assert sum(result.optimization.candidate.selection) == 1
    assert result.optimization.candidate.metadata["physical_quantum_execution"] is False


def test_design_space_fails_when_no_configuration_is_feasible() -> None:
    with pytest.raises(ValueError, match="no chip configuration"):
        optimize_chip_design_space(
            [_configuration("too-hot", power_w=30.0)],
            constraints=ChipDesignConstraints(max_power_w=5.0),
        )


def test_design_space_rejects_duplicate_identifiers() -> None:
    with pytest.raises(ValueError, match="must be unique"):
        optimize_chip_design_space([_configuration("same"), _configuration("same")])


def test_design_space_rejects_more_than_twenty_candidates() -> None:
    with pytest.raises(ValueError, match="limited to 20"):
        optimize_chip_design_space([_configuration(str(index)) for index in range(21)])


def test_chip_design_space_api_exposes_non_physical_execution() -> None:
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).post(
        "/api/v1/optimization/chip/design-space/experiment",
        json={
            "configurations": [
                {
                    "configuration_id": "edge-v0",
                    "throughput_tokens_s": 120,
                    "latency_ms": 15,
                    "power_w": 12,
                    "area_mm2": 5,
                    "memory_mb": 512,
                    "estimated_cost_usd": 100,
                }
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["selected_configuration"]["configuration_id"] == "edge-v0"
    assert body["physical_quantum_execution"] is False
    assert body["quantum_advantage"] is False
