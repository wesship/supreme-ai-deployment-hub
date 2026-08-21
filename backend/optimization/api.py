"""Governed HTTP surface for D3VONN optimization experiments."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .quantum import QuantumOptimizationService

router = APIRouter(prefix="/api/v1/optimization", tags=["optimization"])


class OptimizationRequest(BaseModel):
    values: list[float] = Field(min_length=1, max_length=20)
    weights: list[float] = Field(min_length=1, max_length=20)
    max_cost_usd: float = Field(default=0.0, ge=0.0, le=1000.0)
    minimum_improvement: float = Field(default=0.0, ge=0.0)


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
