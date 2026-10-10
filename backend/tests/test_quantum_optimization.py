from __future__ import annotations

import pytest

from backend.optimization.quantum import (
    LocalQuantumSimulator,
    QuantumOptimizationService,
)


def test_local_simulator_is_explicitly_not_physical_quantum() -> None:
    result = QuantumOptimizationService(LocalQuantumSimulator()).run(
        [0.9, 0.7, 0.4],
        [0.6, 0.4, 0.2],
    )
    assert result.provider.value == "local"
    assert result.candidate.metadata["physical_quantum_execution"] is False
    assert result.quantum_advantage is False
    assert result.reason == "classical baseline retained"


def test_experiment_is_reproducible_for_same_inputs() -> None:
    service = QuantumOptimizationService()
    a = service.run([0.8, 0.5], [0.5, 0.5])
    b = service.run([0.8, 0.5], [0.5, 0.5])
    assert a.experiment_id == b.experiment_id
    assert a.candidate.selection == b.candidate.selection


def test_quantum_budget_is_enforced() -> None:
    class ExpensiveProvider(LocalQuantumSimulator):
        def optimize(self, values, weights):
            candidate = super().optimize(values, weights)
            return candidate.__class__(
                selection=candidate.selection,
                objective_value=candidate.objective_value,
                estimated_cost_usd=1.0,
                backend="test-expensive",
                metadata=candidate.metadata,
            )

    with pytest.raises(PermissionError):
        QuantumOptimizationService(ExpensiveProvider()).run([0.5], [1.0], max_cost_usd=0.0)
