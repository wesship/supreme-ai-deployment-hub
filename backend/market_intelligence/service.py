from __future__ import annotations

import asyncio
import os

from .adapters import provider_adapter
from .models import (
    HermesRoutingPlan,
    MarketIntelligenceQuery,
    MarketIntelligenceResponse,
    ProviderName,
    ProviderStatus,
)


class MarketIntelligenceService:
    """Read-only market research coordination.

    External provider adapters are configuration-gated and GET-only. This
    service never exposes trade, signing, brokerage, exchange, or broadcast
    capabilities. Hermes remains the sole orchestrator.
    """

    _PROVIDERS: tuple[ProviderName, ...] = ("koyfin", "finviz", "messari")

    @staticmethod
    def _enabled(provider: ProviderName) -> bool:
        env_name = f"{provider.upper()}_MARKET_INTELLIGENCE_ENABLED"
        return os.getenv(env_name, "").strip().lower() in {"1", "true", "yes", "on"}

    def provider_statuses(self) -> list[ProviderStatus]:
        statuses: list[ProviderStatus] = []
        for provider in self._PROVIDERS:
            adapter = provider_adapter(provider)
            enabled = self._enabled(provider)
            configured = bool(adapter and adapter.configured)
            statuses.append(
                ProviderStatus(
                    provider=provider,
                    enabled=enabled,
                    configured=configured,
                    mode="read_only",
                    execution_enabled=False,
                    notes=(
                        "Licensed/export bridge is enabled and configured for GET-only collection."
                        if enabled and configured
                        else "Configure the provider's MARKET_INTELLIGENCE_URL and explicitly enable the read-only adapter."
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
            statuses = [
                status
                for status in statuses
                if status.provider in requested or status.provider == "hermes_research_os"
            ]

        configured_sources = [
            status
            for status in statuses
            if status.provider != "hermes_research_os" and status.enabled and status.configured
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

    async def query(self, query: MarketIntelligenceQuery) -> MarketIntelligenceResponse:
        response = self.build_plan(query)
        requested = set(query.providers) if query.providers else set(self._PROVIDERS)
        active = [
            status.provider
            for status in response.providers
            if status.provider in requested
            and status.provider != "hermes_research_os"
            and status.enabled
            and status.configured
        ]
        if not active:
            return response

        async def collect(provider: ProviderName):
            adapter = provider_adapter(provider)
            if adapter is None:
                return provider, [], None
            try:
                return provider, await adapter.collect(query), None
            except Exception as exc:  # provider failures are isolated from Hermes routing
                return provider, [], f"{type(exc).__name__}: {str(exc)[:240]}"

        collected = await asyncio.gather(*(collect(provider) for provider in active))
        signals = []
        errors: dict[str, str] = {}
        for provider, provider_signals, error in collected:
            signals.extend(provider_signals)
            if error:
                errors[provider] = error

        response.signals = sorted(signals, key=lambda signal: signal.confidence, reverse=True)
        response.provider_errors = errors
        return response
