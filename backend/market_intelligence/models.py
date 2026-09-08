from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

AssetClass = Literal["equity", "etf", "crypto", "macro", "mixed"]
ProviderName = Literal["koyfin", "finviz", "messari", "hermes_research_os"]


class MarketIntelligenceQuery(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    asset_class: AssetClass = "mixed"
    symbols: list[str] = Field(default_factory=list, max_length=50)
    providers: list[ProviderName] = Field(default_factory=list, max_length=4)
    save_to_dkos: bool = True
    max_results_per_source: int = Field(default=5, ge=1, le=25)


class ProviderStatus(BaseModel):
    provider: ProviderName
    enabled: bool
    mode: Literal["read_only", "research_router"]
    configured: bool
    execution_enabled: bool = False
    notes: str


class MarketSignal(BaseModel):
    provider: ProviderName
    asset_class: AssetClass
    symbol: str | None = None
    title: str
    summary: str
    source_url: str | None = None
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list, max_length=20)


class HermesRoutingPlan(BaseModel):
    orchestrator: Literal["hermes"] = "hermes"
    research_layer: Literal["backend.research_os"] = "backend.research_os"
    execution_allowed: bool = False
    signing_allowed: bool = False
    broadcast_allowed: bool = False
    workflow: list[str] = Field(
        default_factory=lambda: [
            "collect",
            "normalize",
            "rank_evidence",
            "synthesize",
            "persist_dkos",
            "human_review",
        ]
    )


class MarketIntelligenceResponse(BaseModel):
    schema: Literal["d3vonn.market-intelligence.v1"] = "d3vonn.market-intelligence.v1"
    query: MarketIntelligenceQuery
    providers: list[ProviderStatus]
    routing: HermesRoutingPlan = Field(default_factory=HermesRoutingPlan)
    signals: list[MarketSignal] = Field(default_factory=list)
    status: Literal["ready", "configuration_required"]
