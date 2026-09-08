from __future__ import annotations

import os

from .models import (
    HermesRoutingPlan,
    MarketIntelligenceQuery,
    MarketIntelligenceResponse,
    ProviderStatus,
)


class MarketIntelligenceService:
    """Read-only market research coordination.

    External provider adapters are intentionally configuration-gated. This
    service never exposes trade, signing, brokerage, exchange, or broadcast
    capabilities. Hermes remains the sole orchestrator.
    """

    _PROVIDER_ENV = {
        "koyfin": "KOYFIN_MARKET_INTELLIGENCE_ENABLED",
        "finviz": "FINVIZ_MARKET_INTELLIGENCE_ENABLED",
        "messari": "MESSARI_MARKET_INTELLIGENCE_ENABLED",
    }

    def provider_statuses(self) -> list[ProviderStatus]:
        statuses: list[ProviderStatus] = []
        for provider, env_name in self._PROVIDER_ENV.items():
            configured = os.getenv(env_name, "").strip().lower() in {"1", "true", "yes", "on"}
            statuses.append(
                ProviderStatus(
                    provider=provider,
                    enabled=configured,
                    configured=configured,
                    mode="read_only",
                    execution_enabled=False,
                    notes=(
                        "Read-only market intelligence adapter enabled."
                        if configured
                        else f"Set {env_name}=true only after a supported read-only data path is configured."
                    ),
                )
            )

        statuses.append(
            ProviderStatus(
                provider="hermes_research_os",
                enabled=True,
                configured=True,
                mode="research_router",
                execution_enabled=False,
                notes="Canonical research/ranking/persistence layer; Hermes remains the orchestrator.",
            )
        )
        return statuses

    def build_plan(self, query: MarketIntelligenceQuery) -> MarketIntelligenceResponse:
        statuses = self.provider_statuses()
        requested = set(query.providers)
        if requested:
            statuses = [status for status in statuses if status.provider in requested or status.provider == "hermes_research_os"]

        configured_sources = [
            status for status in statuses if status.provider != "hermes_research_os" and status.configured
        ]
        workflow = ["collect", "normalize", "rank_evidence", "synthesize"]
        if query.save_to_dkos:
            workflow.append("persist_dkos")
        workflow.append("human_review")

        return MarketIntelligenceResponse(
            query=query,
            providers=statuses,
            routing=HermesRoutingPlan(workflow=workflow),
            signals=[],
            status="ready" if configured_sources else "configuration_required",
        )
