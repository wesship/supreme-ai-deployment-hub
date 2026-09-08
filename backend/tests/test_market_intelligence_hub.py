import asyncio
from types import SimpleNamespace

from backend.market_intelligence.adapters import ReadOnlyMarketAdapter
from backend.market_intelligence.models import MarketIntelligenceQuery, MarketSignal
from backend.market_intelligence.service import MarketIntelligenceService


PROVIDERS = ("KOYFIN", "FINVIZ", "MESSARI")


def _clear_provider_env(monkeypatch):
    for provider in PROVIDERS:
        monkeypatch.delenv(f"{provider}_MARKET_INTELLIGENCE_ENABLED", raising=False)
        monkeypatch.delenv(f"{provider}_MARKET_INTELLIGENCE_URL", raising=False)
        monkeypatch.delenv(f"{provider}_MARKET_INTELLIGENCE_TOKEN", raising=False)


def test_market_intelligence_defaults_to_read_only(monkeypatch):
    _clear_provider_env(monkeypatch)

    service = MarketIntelligenceService()
    response = service.build_plan(MarketIntelligenceQuery(query="market breadth and crypto momentum"))

    assert response.schema == "d3vonn.market-intelligence.v1"
    assert response.status == "configuration_required"
    assert response.routing.orchestrator == "hermes"
    assert response.routing.execution_allowed is False
    assert response.routing.signing_allowed is False
    assert response.routing.broadcast_allowed is False
    assert "research_os_persist_dkos" in response.routing.workflow
    assert all(provider.execution_enabled is False for provider in response.providers)
    assert response.signals == []


def test_enabled_provider_requires_https_read_bridge(monkeypatch):
    _clear_provider_env(monkeypatch)
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_ENABLED", "true")

    response = MarketIntelligenceService().build_plan(
        MarketIntelligenceQuery(query="ethereum protocol activity", asset_class="crypto", providers=["messari"])
    )

    assert response.status == "configuration_required"
    messari = next(provider for provider in response.providers if provider.provider == "messari")
    assert messari.enabled is True
    assert messari.configured is False
    assert messari.execution_enabled is False


def test_configured_provider_is_ready_but_still_non_executing(monkeypatch):
    _clear_provider_env(monkeypatch)
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_URL", "https://market-data.example.com/messari")

    response = MarketIntelligenceService().build_plan(
        MarketIntelligenceQuery(query="ethereum protocol activity", asset_class="crypto", providers=["messari"])
    )

    assert response.status == "ready"
    messari = next(provider for provider in response.providers if provider.provider == "messari")
    assert messari.configured is True
    assert messari.mode == "read_only"
    assert messari.execution_enabled is False
    assert any(provider.provider == "hermes_research_os" for provider in response.providers)


def test_adapter_rejects_non_https_and_local_destinations(monkeypatch):
    _clear_provider_env(monkeypatch)
    adapter = ReadOnlyMarketAdapter("finviz")

    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_URL", "http://market-data.example.com/finviz")
    assert adapter.configured is False

    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_URL", "https://localhost/finviz")
    assert adapter.configured is False

    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_URL", "https://market-data.example.com/finviz")
    assert adapter.configured is True


def test_dkos_opt_out_removes_persistence_step(monkeypatch):
    _clear_provider_env(monkeypatch)
    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_URL", "https://market-data.example.com/finviz")

    response = MarketIntelligenceService().build_plan(
        MarketIntelligenceQuery(
            query="equity breadth without persistence",
            asset_class="equity",
            providers=["finviz"],
            save_to_dkos=False,
        )
    )

    assert response.query.save_to_dkos is False
    assert "research_os_persist_dkos" not in response.routing.workflow
    assert response.routing.workflow == [
        "collect_provider_bridges",
        "normalize",
        "research_os_rank_evidence",
        "research_os_synthesize",
        "human_review",
    ]


def test_live_query_runs_research_os_ranker_and_dkos_writer(monkeypatch):
    _clear_provider_env(monkeypatch)
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_URL", "https://market-data.example.com/messari")

    class FakeAdapter:
        configured = True

        async def collect(self, query):
            return [
                MarketSignal(
                    provider="messari",
                    asset_class="crypto",
                    symbol="ETH",
                    title="Ethereum protocol activity accelerates",
                    summary="Ethereum protocol activity and fee momentum increased this week.",
                    source_url="https://market-data.example.com/evidence/eth",
                    confidence=0.4,
                    tags=["ethereum", "protocol"],
                )
            ]

    class FakeDKOSWriter:
        def __init__(self):
            self.calls = 0
            self.saved_evidence = []

        async def save(self, request, evidence, leads):
            self.calls += 1
            self.saved_evidence = evidence
            assert request.save_to_dkos is True
            assert leads == []
            return SimpleNamespace(status="saved", records=len(evidence), message=None)

    monkeypatch.setattr("backend.market_intelligence.service.provider_adapter", lambda provider: FakeAdapter())
    service = MarketIntelligenceService()
    fake_writer = FakeDKOSWriter()
    service.dkos_writer = fake_writer

    response = asyncio.run(
        service.query(
            MarketIntelligenceQuery(
                query="ethereum protocol activity",
                asset_class="crypto",
                providers=["messari"],
            )
        )
    )

    assert fake_writer.calls == 1
    assert len(fake_writer.saved_evidence) == 1
    assert fake_writer.saved_evidence[0].score > 0
    assert response.dkos_status == "saved"
    assert response.dkos_records == 1
    assert len(response.signals) == 1
    assert response.signals[0].confidence == fake_writer.saved_evidence[0].score
    assert "Hermes Research OS ranked 1 read-only market signals" in response.summary
