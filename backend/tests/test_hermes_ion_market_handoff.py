import asyncio

from backend.hermes.market_analysis import build_ion_market_payload, create_ion_market_analysis_task
from backend.hermes.registry import BUILTIN_AGENT_REGISTRY
from backend.market_intelligence.models import (
    MarketIntelligenceQuery,
    MarketIntelligenceResponse,
    MarketSignal,
    ProviderStatus,
)


def _response() -> MarketIntelligenceResponse:
    return MarketIntelligenceResponse(
        query=MarketIntelligenceQuery(query="bitcoin momentum", asset_class="crypto", save_to_dkos=False),
        providers=[
            ProviderStatus(
                provider="messari",
                enabled=True,
                configured=True,
                mode="read_only",
                execution_enabled=False,
                notes="test",
            )
        ],
        signals=[
            MarketSignal(
                provider="messari",
                asset_class="crypto",
                symbol="BTC",
                title="Bitcoin momentum",
                summary="Ranked test signal",
                source_url="https://example.invalid/btc",
                confidence=0.87,
            )
        ],
        summary="Ranked market signal",
        status="ready",
    )


def test_ion_manifest_has_market_analysis_but_no_execution_tool():
    ion = BUILTIN_AGENT_REGISTRY.get("ion")
    assert "market.analyze" in ion.capabilities
    assert "market.read" in ion.permissions
    assert all(tool.name != "market.trade" for tool in ion.tools)


def test_payload_preserves_provenance_confidence_and_read_only_policy():
    payload = build_ion_market_payload(_response())
    assert payload["signals"][0]["provider"] == "messari"
    assert payload["signals"][0]["confidence"] == 0.87
    assert payload["provenance"]["confidence_scored"] is True
    assert payload["policy"] == {
        "execution_allowed": False,
        "trading_allowed": False,
        "signing_allowed": False,
        "broadcast_allowed": False,
        "analysis_only": True,
    }


def test_handoff_creates_canonical_ion_task():
    captured = {}

    async def fake_create_task(**kwargs):
        captured.update(kwargs)
        return {"id": "task-ion-market", **kwargs}

    task = asyncio.run(
        create_ion_market_analysis_task(
            _response(),
            create_task_fn=fake_create_task,
            parent_task_id="parent-1",
            correlation_id="corr-1",
        )
    )

    assert task["agent_name"] == "ION"
    assert task["task_type"] == "market_analysis"
    assert task["source"] == "hermes_market_intelligence"
    assert task["parent_task_id"] == "parent-1"
    assert task["correlation_id"] == "corr-1"
    assert captured["input_data"]["policy"]["analysis_only"] is True
