"""Bounded design-space exploration for D3VONN Chip Lab.

The service reduces feasible hardware configurations to a one-of-N allocation
problem and delegates candidate comparison to the governed optimization fabric.
Physical quantum execution remains disabled unless an approved provider is
explicitly injected into ``QuantumOptimizationService``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .quantum import OptimizationExperiment, QuantumOptimizationService


@dataclass(frozen=True)
class ChipConfiguration:
    configuration_id: str
    throughput_tokens_s: float
    latency_ms: float
    power_w: float
    area_mm2: float
    memory_mb: float
    estimated_cost_usd: float


@dataclass(frozen=True)
class ChipDesignConstraints:
    max_latency_ms: float | None = None
    max_power_w: float | None = None
    max_area_mm2: float | None = None
    max_memory_mb: float | None = None
    max_estimated_cost_usd: float | None = None


@dataclass(frozen=True)
class ChipScoreWeights:
    throughput: float = 1.0
    latency: float = 1.0
    power: float = 1.0
    area: float = 1.0
    memory: float = 1.0
    cost: float = 1.0


@dataclass(frozen=True)
class ChipDesignSpaceExperiment:
    selected_configuration: ChipConfiguration
    feasible_configuration_ids: tuple[str, ...]
    scores: tuple[float, ...]
    optimization: OptimizationExperiment


def _positive(value: float, field: str) -> None:
    if value <= 0:
        raise ValueError(f"{field} must be greater than zero")


def _validate_configuration(configuration: ChipConfiguration) -> None:
    if not configuration.configuration_id.strip():
        raise ValueError("configuration_id must not be empty")
    for field in (
        "throughput_tokens_s",
        "latency_ms",
        "power_w",
        "area_mm2",
        "memory_mb",
        "estimated_cost_usd",
    ):
        _positive(getattr(configuration, field), field)


def _is_feasible(configuration: ChipConfiguration, constraints: ChipDesignConstraints) -> bool:
    limits = (
        (configuration.latency_ms, constraints.max_latency_ms),
        (configuration.power_w, constraints.max_power_w),
        (configuration.area_mm2, constraints.max_area_mm2),
        (configuration.memory_mb, constraints.max_memory_mb),
        (configuration.estimated_cost_usd, constraints.max_estimated_cost_usd),
    )
    return all(limit is None or value <= limit for value, limit in limits)


def optimize_chip_design_space(
    configurations: Sequence[ChipConfiguration],
    *,
    constraints: ChipDesignConstraints | None = None,
    score_weights: ChipScoreWeights | None = None,
    optimizer: QuantumOptimizationService | None = None,
    max_experiment_cost_usd: float = 0.0,
) -> ChipDesignSpaceExperiment:
    """Select one feasible configuration using normalized, explicit metrics."""
    if not configurations:
        raise ValueError("at least one chip configuration is required")
    if len(configurations) > 20:
        raise ValueError("chip design-space experiments are limited to 20 configurations")
    for configuration in configurations:
        _validate_configuration(configuration)
    identifiers = [item.configuration_id for item in configurations]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("configuration_id values must be unique")

    active_constraints = constraints or ChipDesignConstraints()
    active_weights = score_weights or ChipScoreWeights()
    weights = tuple(vars(active_weights).values())
    if any(weight < 0 for weight in weights) or not any(weight > 0 for weight in weights):
        raise ValueError("score weights must be non-negative with at least one positive value")

    feasible = [item for item in configurations if _is_feasible(item, active_constraints)]
    if not feasible:
        raise ValueError("no chip configuration satisfies the design constraints")

    max_throughput = max(item.throughput_tokens_s for item in feasible)
    minima = {
        "latency": min(item.latency_ms for item in feasible),
        "power": min(item.power_w for item in feasible),
        "area": min(item.area_mm2 for item in feasible),
        "memory": min(item.memory_mb for item in feasible),
        "cost": min(item.estimated_cost_usd for item in feasible),
    }
    total_weight = sum(weights)
    scores = tuple(
        (
            active_weights.throughput * (item.throughput_tokens_s / max_throughput)
            + active_weights.latency * (minima["latency"] / item.latency_ms)
            + active_weights.power * (minima["power"] / item.power_w)
            + active_weights.area * (minima["area"] / item.area_mm2)
            + active_weights.memory * (minima["memory"] / item.memory_mb)
            + active_weights.cost * (minima["cost"] / item.estimated_cost_usd)
        )
        / total_weight
        for item in feasible
    )

    service = optimizer or QuantumOptimizationService()
    experiment = service.run(
        scores,
        [1.0] * len(scores),
        max_cost_usd=max_experiment_cost_usd,
    )
    selected_indexes = [index for index, selected in enumerate(experiment.candidate.selection) if selected]
    if len(selected_indexes) != 1:
        raise RuntimeError("chip design-space optimizer must select exactly one configuration")

    return ChipDesignSpaceExperiment(
        selected_configuration=feasible[selected_indexes[0]],
        feasible_configuration_ids=tuple(item.configuration_id for item in feasible),
        scores=scores,
        optimization=experiment,
    )
