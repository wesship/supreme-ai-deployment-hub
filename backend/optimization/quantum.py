"""Provider-neutral, governance-friendly optimization primitives.

The default implementation is a deterministic local simulator/benchmark. Real
IBM Quantum or AWS Braket adapters can implement the QuantumProvider protocol
without changing callers. Quantum execution is never assumed to outperform a
classical baseline; the service records both results and estimated cost.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from itertools import product
from time import monotonic
from typing import Mapping, Protocol, Sequence


class QuantumProvider(str, Enum):
    LOCAL = "local"
    IBM = "ibm"
    AWS_BRAKET = "aws_braket"


class QuantumBackend(Protocol):
    provider: QuantumProvider

    def optimize(self, values: Sequence[float], weights: Sequence[float]) -> "OptimizationCandidate":
        """Return the provider's best candidate for a binary allocation problem."""


@dataclass(frozen=True)
class OptimizationCandidate:
    selection: tuple[int, ...]
    objective_value: float
    estimated_cost_usd: float
    backend: str
    metadata: Mapping[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class OptimizationExperiment:
    experiment_id: str
    provider: QuantumProvider
    baseline: OptimizationCandidate
    candidate: OptimizationCandidate
    improvement: float
    quantum_advantage: bool
    reason: str


class LocalClassicalBaseline:
    """Exact small-problem baseline used for regression and provider comparison."""

    provider = QuantumProvider.LOCAL

    def optimize(self, values: Sequence[float], weights: Sequence[float]) -> OptimizationCandidate:
        if len(values) != len(weights) or not values:
            raise ValueError("values and weights must be non-empty and equal length")
        best: tuple[float, tuple[int, ...]] | None = None
        for selection in product((0, 1), repeat=len(values)):
            score = sum(v * s for v, s in zip(values, selection))
            used = sum(w * s for w, s in zip(weights, selection))
            if used > 1.0:
                continue
            if best is None or score > best[0]:
                best = (score, selection)
        if best is None:
            raise ValueError("no feasible allocation")
        return OptimizationCandidate(
            selection=best[1],
            objective_value=best[0],
            estimated_cost_usd=0.0,
            backend="local-exact-baseline",
        )


class LocalQuantumSimulator:
    """Deterministic placeholder simulator with an explicit non-advantage policy.

    This intentionally does not pretend to execute a physical quantum circuit.
    It supplies a provider-shaped integration point until an approved QPU
    dependency and credentials are configured.
    """

    provider = QuantumProvider.LOCAL

    def optimize(self, values: Sequence[float], weights: Sequence[float]) -> OptimizationCandidate:
        baseline = LocalClassicalBaseline().optimize(values, weights)
        return OptimizationCandidate(
            selection=baseline.selection,
            objective_value=baseline.objective_value,
            estimated_cost_usd=0.0,
            backend="local-simulator-disabled-qpu",
            metadata={"physical_quantum_execution": False},
        )


class QuantumOptimizationService:
    """Compare an optimization candidate with a trusted classical baseline."""

    def __init__(self, provider: QuantumBackend | None = None) -> None:
        self.provider = provider or LocalQuantumSimulator()
        self.baseline = LocalClassicalBaseline()

    def run(
        self,
        values: Sequence[float],
        weights: Sequence[float],
        *,
        max_cost_usd: float = 0.0,
        minimum_improvement: float = 0.0,
    ) -> OptimizationExperiment:
        if max_cost_usd < 0:
            raise ValueError("max_cost_usd cannot be negative")
        started = monotonic()
        baseline = self.baseline.optimize(values, weights)
        candidate = self.provider.optimize(values, weights)
        if candidate.estimated_cost_usd > max_cost_usd:
            raise PermissionError("quantum experiment exceeds configured budget")
        improvement = candidate.objective_value - baseline.objective_value
        advantage = improvement > minimum_improvement and candidate.estimated_cost_usd <= max_cost_usd
        digest = sha256(
            repr((tuple(values), tuple(weights), candidate.selection, candidate.backend)).encode()
        ).hexdigest()[:16]
        reason = "candidate beats classical baseline" if advantage else "classical baseline retained"
        metadata = dict(candidate.metadata)
        metadata.update({"elapsed_ms": round((monotonic() - started) * 1000, 3)})
        candidate = OptimizationCandidate(
            selection=candidate.selection,
            objective_value=candidate.objective_value,
            estimated_cost_usd=candidate.estimated_cost_usd,
            backend=candidate.backend,
            metadata=metadata,
        )
        return OptimizationExperiment(
            experiment_id=digest,
            provider=self.provider.provider,
            baseline=baseline,
            candidate=candidate,
            improvement=improvement,
            quantum_advantage=advantage,
            reason=reason,
        )
