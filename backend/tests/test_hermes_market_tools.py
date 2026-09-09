from __future__ import annotations

import asyncio

import pytest

from backend.hermes.market_tools import MARKET_TOOL_NAMES, invoke_market_tool
from backend.hermes.registry import BUILTIN_AGENT_REGISTRY


class FakeMarketService:
    async def asset_metrics(self, asset: str):
        return {"provider": "fake", "asset": asset}

    async def search_assets(self, query: str):
        return [{"slug": query}]

    async def exchanges(self):
        return [{"name": "example"}]


def run(coro):
    return asyncio.run(coro)


def test_market_tools_are_allow_listed_and_read_only():
    assert MARKET_TOOL_NAMES == {
        "market.lookup_asset",
        "market.search_assets",
        "market.list_exchanges",
    }
    for agent_id in ("hermes", "tars"):
        manifest = BUILTIN_AGENT_REGISTRY.get(agent_id)
        tools = {tool.name: tool for tool in manifest.tools}
        for name in MARKET_TOOL_NAMES:
            assert name in tools
            assert tools[name].destructive is False
            assert tools[name].permissions == ["market.read"]


def test_market_tool_dispatch_uses_service_boundary():
    service = FakeMarketService()
    assert run(invoke_market_tool("market.lookup_asset", {"asset": "bitcoin"}, service=service)) == {
        "provider": "fake",
        "asset": "bitcoin",
    }
    search = run(invoke_market_tool("market.search_assets", {"query": "eth"}, service=service))
    assert search["results"] == [{"slug": "eth"}]
    exchanges = run(invoke_market_tool("market.list_exchanges", service=service))
    assert exchanges["results"] == [{"name": "example"}]


def test_market_tool_rejects_unknown_or_missing_arguments():
    service = FakeMarketService()
    with pytest.raises(ValueError, match="Unknown market tool"):
        run(invoke_market_tool("market.trade", {}, service=service))
    with pytest.raises(ValueError, match="requires a non-empty 'asset'"):
        run(invoke_market_tool("market.lookup_asset", {}, service=service))
