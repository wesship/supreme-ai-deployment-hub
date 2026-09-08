from __future__ import annotations

import asyncio
import os

from backend.research_os.agents import DKOSMemoryWriterAgent, EvidenceRankerAgent
from backend.research_os.models import EvidenceItem, ResearchQueryRequest, ResearchSource

from .adapters import provider_adapter
from .models import (
    HermesRoutingPlan,
    MarketIntelligenceQuery,
    MarketIntelligenceResponse,
    MarketSignal,
    ProviderName,
    ProviderStatus,
)


class MarketIntelligenceService:
    """Read-only market research coordination through Hermes Research OS.

    External provider adapters are configuration-gated and GET-only. Provider
    bridges perform collection only; canonical evidence ranking and DKOS
    persistence are delegated to backend.research_os. This service never exposes
    trade, signing, brokerage, exchange, or broadcast capabilities.
    """

    _PROVIDERS: tuple[ProviderName, ...] = ("koyfin", "finviz", "messari")

    def __init__(self) -> None:
        self.ranker = EvidenceRankerAgent()
        self.dkos_writer = DKOSMemoryWriterAgent()

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
                notes="Canonical ranking/synthesis/persistence layer; Hermes remains the orchestrator.",
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
        workflow = [
            "collect_provider_bridges",
            "normalize",
            "research_os_rank_evidence",
            "research_os_synthesize",
        ]
        if query.save_to_dkos:
            workflow.append("research_os_persist_dkos")
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
            response.summary = "No configured read-only market providers were available for this request."
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
        signals: list[MarketSignal] = []
        errors: dict[str, str] = {}
        for provider, provider_signals, error in collected:
            signals.extend(provider_signals)
            if error:
                errors[provider] = error

        response.provider_errors = errors
        if not signals:
            response.summary = "Configured provider bridges returned no market signals."
            return response

        evidence: list[EvidenceItem] = []
        signal_by_id: dict[str, MarketSignal] = {}
        for signal in signals:
            item = EvidenceItem(
                source=ResearchSource.web,
                title=signal.title,
                url=signal.source_url,
                snippet=signal.summary,
                published_at=signal.observed_at,
                raw={
                    "market_provider": signal.provider,
                    "asset_class": signal.asset_class,
                    "symbol": signal.symbol,
                    "tags": signal.tags,
                    "provider_confidence": signal.confidence,
                },
            )
            evidence.append(item)
            signal_by_id[item.id] = signal

        ranked = self.ranker.rank(query.query, evidence, limit=len(evidence))
        ranked_signals: list[MarketSignal] = []
        for item in ranked:
            signal = signal_by_id[item.id]
            signal.confidence = max(0.0, min(1.0, item.score))
            ranked_signals.append(signal)

        research_request = ResearchQueryRequest(
            query=query.query,
            objective="Rank, synthesize, and persist read-only market intelligence collected by approved provider bridges.",
            max_results_per_source=query.max_results_per_source,
            enrich_leads=False,
            save_to_dkos=query.save_to_dkos,
            metadata={"origin": "market_intelligence_hub", "providers": active},
        )
        dkos = await self.dkos_writer.save(research_request, ranked, [])

        response.signals = ranked_signals
        response.summary = self._synthesize(query, ranked_signals, errors)
        response.dkos_status = dkos.status
        response.dkos_records = dkos.records
        response.dkos_message = dkos.message
        return response

    @staticmethod
    def _synthesize(
        query: MarketIntelligenceQuery,
        signals: list[MarketSignal],
        errors: dict[str, str],
    ) -> str:
        if not signals:
            return "No market signals were available to synthesize."
        top = signals[:3]
        providers = sorted({signal.provider for signal in signals})
        top_text = "; ".join(
            f"{signal.symbol + ': ' if signal.symbol else ''}{signal.title}"
            for signal in top
        )
        error_text = f" Provider errors: {', '.join(sorted(errors))}." if errors else ""
        return (
            f"Hermes Research OS ranked {len(signals)} read-only market signals for '{query.query}' "
            f"across {', '.join(providers)}. Top signals: {top_text}.{error_text}"
        )
