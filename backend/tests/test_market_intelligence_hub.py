from backend.market_intelligence.adapters import ReadOnlyMarketAdapter
from backend.market_intelligence.models import MarketIntelligenceQuery
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
    assert "persist_dkos" in response.routing.workflow
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
    assert "persist_dkos" not in response.routing.workflow
    assert response.routing.workflow == [
        "collect",
        "normalize",
        "rank_evidence",
        "synthesize",
        "human_review",
    ]
