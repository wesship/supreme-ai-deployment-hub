"""Campaign/resource allocation adapter built on the optimization fabric."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .quantum import OptimizationExperiment, QuantumOptimizationService


@dataclass(frozen=True)
class CampaignAllocation:
    campaign_ids: tuple[str, ...]
    expected_values: tuple[float, ...]
    resource_weights: tuple[float, ...]
    experiment: OptimizationExperiment


def optimize_campaign_allocation(
    campaign_ids: Sequence[str],
    expected_values: Sequence[float],
    resource_weights: Sequence[float],
    *,
    max_cost_usd: float = 0.0,
) -> CampaignAllocation:
    if not campaign_ids or len(campaign_ids) != len(expected_values) or len(campaign_ids) != len(resource_weights):
        raise ValueError("campaign_ids, expected_values, and resource_weights must have equal non-empty length")
    experiment = QuantumOptimizationService().run(
        expected_values,
        resource_weights,
        max_cost_usd=max_cost_usd,
    )
    return CampaignAllocation(tuple(campaign_ids), tuple(expected_values), tuple(resource_weights), experiment)
