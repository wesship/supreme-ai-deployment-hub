# D3VONN Market Intelligence Hub v0.1

## Purpose

Provide a read-only market research layer for equities, macro, and crypto while keeping Hermes as the canonical orchestrator and keeping all trade execution outside the intelligence path.

## Sources

- Koyfin: equities, macro, portfolio and market dashboards.
- Finviz: equities screening, breadth, technical/fundamental filters, heatmaps and news discovery.
- Messari: crypto assets, protocols, token/project research and market intelligence.
- Hermes Research OS: routing, evidence ranking, synthesis and DKOS persistence.

External sources are configuration-gated. V0.1 does not scrape, sign in to, or execute through any provider automatically.

## API

- `GET /api/market-intelligence/health`
- `POST /api/market-intelligence/query`

Example:

```json
{
  "query": "Find weakening market breadth with strengthening crypto momentum",
  "asset_class": "mixed",
  "symbols": ["SPY", "QQQ", "BTC", "ETH"],
  "providers": ["finviz", "koyfin", "messari"],
  "save_to_dkos": true,
  "max_results_per_source": 5
}
```

## Hermes workflow

`COLLECT -> NORMALIZE -> RANK EVIDENCE -> SYNTHESIZE -> PERSIST DKOS -> HUMAN REVIEW`

This module does not introduce another scheduler, queue, memory system, or orchestrator.

## Safety boundary

V0.1 is intelligence-only:

- no brokerage or exchange order placement
- no wallet signing
- no transaction broadcast
- no private key or mnemonic handling
- no autonomous fund movement
- all provider entries expose `execution_enabled=false`

Any future execution feature must use the separately governed D3VONN execution/custody path and must not be added to this research module.

## Configuration

Provider flags remain off by default:

```env
KOYFIN_MARKET_INTELLIGENCE_ENABLED=false
FINVIZ_MARKET_INTELLIGENCE_ENABLED=false
MESSARI_MARKET_INTELLIGENCE_ENABLED=false
```

Set a flag only after a supported read-only data path for that provider is configured and reviewed.
