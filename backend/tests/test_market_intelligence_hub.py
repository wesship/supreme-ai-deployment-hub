from backend.market_intelligence.models import MarketIntelligenceQuery
from backend.market_intelligence.service import MarketIntelligenceService


def test_market_intelligence_defaults_to_read_only(monkeypatch):
    for name in (
        "KOYFIN_MARKET_INTELLIGENCE_ENABLED",
        "FINVIZ_MARKET_INTELLIGENCE_ENABLED",
        "MESSARI_MARKET_INTELLIGENCE_ENABLED",
    ):
        monkeypatch.delenv(name, raising=False)

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


def test_enabled_provider_is_still_non_executing(monkeypatch):
    monkeypatch.setenv("MESSARI_MARKET_INTELLIGENCE_ENABLED", "true")

    response = MarketIntelligenceService().build_plan(
        MarketIntelligenceQuery(query="ethereum protocol activity", asset_class="crypto", providers=["messari"])
    )

    assert response.status == "ready"
    messari = next(provider for provider in response.providers if provider.provider == "messari")
    assert messari.configured is True
    assert messari.mode == "read_only"
    assert messari.execution_enabled is False
    assert any(provider.provider == "hermes_research_os" for provider in response.providers)


def test_dkos_opt_out_removes_persistence_step(monkeypatch):
    monkeypatch.setenv("FINVIZ_MARKET_INTELLIGENCE_ENABLED", "true")

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
