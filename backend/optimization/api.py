"""Governed HTTP surface for D3VONN optimization experiments."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .chip import (
    ChipConfiguration,
    ChipDesignConstraints,
    ChipScoreWeights,
    optimize_chip_design_space,
)
from .quantum import QuantumOptimizationService

router = APIRouter(prefix="/api/v1/optimization", tags=["optimization"])


class OptimizationRequest(BaseModel):
    values: list[float] = Field(min_length=1, max_length=20)
    weights: list[float] = Field(min_length=1, max_length=20)
    max_cost_usd: float = Field(default=0.0, ge=0.0, le=1000.0)
    minimum_improvement: float = Field(default=0.0, ge=0.0)


class ChipConfigurationRequest(BaseModel):
    configuration_id: str = Field(min_length=1, max_length=100)
    throughput_tokens_s: float = Field(gt=0)
    latency_ms: float = Field(gt=0)
    power_w: float = Field(gt=0)
    area_mm2: float = Field(gt=0)
    memory_mb: float = Field(gt=0)
    estimated_cost_usd: float = Field(gt=0)


class ChipDesignConstraintsRequest(BaseModel):
    max_latency_ms: float | None = Field(default=None, gt=0)
    max_power_w: float | None = Field(default=None, gt=0)
    max_area_mm2: float | None = Field(default=None, gt=0)
    max_memory_mb: float | None = Field(default=None, gt=0)
    max_estimated_cost_usd: float | None = Field(default=None, gt=0)


class ChipScoreWeightsRequest(BaseModel):
    throughput: float = Field(default=1.0, ge=0)
    latency: float = Field(default=1.0, ge=0)
    power: float = Field(default=1.0, ge=0)
    area: float = Field(default=1.0, ge=0)
    memory: float = Field(default=1.0, ge=0)
    cost: float = Field(default=1.0, ge=0)


class ChipDesignSpaceRequest(BaseModel):
    configurations: list[ChipConfigurationRequest] = Field(min_length=1, max_length=20)
    constraints: ChipDesignConstraintsRequest = Field(default_factory=ChipDesignConstraintsRequest)
    score_weights: ChipScoreWeightsRequest = Field(default_factory=ChipScoreWeightsRequest)
    max_experiment_cost_usd: float = Field(default=0.0, ge=0.0, le=1000.0)


@router.post("/quantum/experiment")
async def run_quantum_experiment(request: OptimizationRequest):
    if len(request.values) != len(request.weights):
        raise HTTPException(status_code=422, detail="values and weights must have equal length")
    try:
        experiment = QuantumOptimizationService().run(
            request.values,
            request.weights,
            max_cost_usd=request.max_cost_usd,
            minimum_improvement=request.minimum_improvement,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "experiment_id": experiment.experiment_id,
        "provider": experiment.provider.value,
        "baseline": experiment.baseline,
        "candidate": experiment.candidate,
        "improvement": experiment.improvement,
        "quantum_advantage": experiment.quantum_advantage,
        "reason": experiment.reason,
    }


@router.post("/chip/design-space/experiment")
async def run_chip_design_space_experiment(request: ChipDesignSpaceRequest):
    try:
        result = optimize_chip_design_space(
            [ChipConfiguration(**item.model_dump()) for item in request.configurations],
            constraints=ChipDesignConstraints(**request.constraints.model_dump()),
            score_weights=ChipScoreWeights(**request.score_weights.model_dump()),
            max_experiment_cost_usd=request.max_experiment_cost_usd,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "experiment_id": result.optimization.experiment_id,
        "provider": result.optimization.provider.value,
        "selected_configuration": result.selected_configuration,
        "feasible_configuration_ids": result.feasible_configuration_ids,
        "scores": result.scores,
        "physical_quantum_execution": result.optimization.candidate.metadata.get(
            "physical_quantum_execution", False
        ),
        "quantum_advantage": result.optimization.quantum_advantage,
        "reason": result.optimization.reason,
    }
