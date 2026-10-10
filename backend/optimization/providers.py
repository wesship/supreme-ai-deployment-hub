"""Optional physical quantum-provider adapters.

Adapters are dependency- and credential-gated. Importing this module never
requires Qiskit or Amazon Braket to be installed, and no provider is enabled
by default. Production callers should wrap these providers with the existing
Agent Mesh governance and budget controls.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Sequence

from .quantum import OptimizationCandidate, QuantumProvider


@dataclass(frozen=True)
class ProviderConfig:
    enabled: bool
    backend: str
    estimated_cost_usd: float = 0.0


def ibm_config() -> ProviderConfig:
    return ProviderConfig(
        enabled=os.getenv("D3VONN_QUANTUM_IBM_ENABLED", "false").lower() == "true"
        and bool(os.getenv("IBM_QUANTUM_TOKEN")),
        backend=os.getenv("D3VONN_QUANTUM_IBM_BACKEND", ""),
        estimated_cost_usd=float(os.getenv("D3VONN_QUANTUM_IBM_ESTIMATED_COST_USD", "0")),
    )


def braket_config() -> ProviderConfig:
    return ProviderConfig(
        enabled=os.getenv("D3VONN_QUANTUM_BRAKET_ENABLED", "false").lower() == "true"
        and bool(os.getenv("AWS_REGION")),
        backend=os.getenv("D3VONN_QUANTUM_BRAKET_DEVICE", ""),
        estimated_cost_usd=float(os.getenv("D3VONN_QUANTUM_BRAKET_ESTIMATED_COST_USD", "0")),
    )


class DisabledPhysicalProvider:
    """Fail closed until a reviewed SDK adapter is explicitly enabled."""

    def __init__(self, provider: QuantumProvider, backend: str = "") -> None:
        self.provider = provider
        self.backend = backend

    def optimize(self, values: Sequence[float], weights: Sequence[float]) -> OptimizationCandidate:
        raise RuntimeError(
            f"{self.provider.value} physical execution is not enabled; "
            "configure and review the provider adapter before enabling it"
        )
