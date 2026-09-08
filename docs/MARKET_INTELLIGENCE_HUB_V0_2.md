# D3VONN Market Intelligence Hub v0.2

## Objective

V0.2 turns the v0.1 planning contract into a live, read-only market intelligence surface while preserving Hermes as the sole orchestrator and keeping custody/execution out of scope.

## Dashboard

Frontend route:

- `/market-intelligence`

Backend endpoints:

- `GET /api/market-intelligence/health`
- `POST /api/market-intelligence/query`

## Provider bridge contract

D3VONN does not scrape provider websites in this implementation. Each provider is connected through an operator-configured HTTPS read bridge representing a licensed API, export service, or approved data gateway.

```env
KOYFIN_MARKET_INTELLIGENCE_ENABLED=false
KOYFIN_MARKET_INTELLIGENCE_URL=
KOYFIN_MARKET_INTELLIGENCE_TOKEN=

FINVIZ_MARKET_INTELLIGENCE_ENABLED=false
FINVIZ_MARKET_INTELLIGENCE_URL=
FINVIZ_MARKET_INTELLIGENCE_TOKEN=

MESSARI_MARKET_INTELLIGENCE_ENABLED=false
MESSARI_MARKET_INTELLIGENCE_URL=
MESSARI_MARKET_INTELLIGENCE_TOKEN=
```

A provider is `ready` only when its explicit enable flag is true and its configured URL is valid HTTPS. Localhost and `.local` destinations are rejected.

Provider credentials remain backend-only. The dashboard calls only the D3VONN API.

## Read bridge request

D3VONN performs GET-only requests with query parameters:

- `q`
- `asset_class`
- `symbols` (comma-separated)
- `limit`

Optional bridge authentication uses a server-side bearer token.

## Normalized response

A bridge may return either an array or `{ "items": [...] }`. Each row can provide:

- `title` or `name`
- `summary`, `snippet`, or `description`
- `symbol`
- `asset_class`
- `source_url` or `url`
- `confidence` in `[0,1]`
- `tags`

D3VONN normalizes valid rows into `MarketSignal` records, ranks by confidence, isolates provider failures, and returns `provider_errors` without failing the entire Hermes research request.

## Hermes workflow

`collect -> normalize -> rank_evidence -> synthesize -> [persist_dkos] -> human_review`

`persist_dkos` is present only when the caller sets `save_to_dkos=true`.

## Safety boundary

Hard invariants:

- no brokerage/exchange execution
- no order placement
- no wallet signing
- no transaction broadcast
- no private key or mnemonic handling
- no provider credentials in the frontend
- no user-controlled provider destination URLs
- Hermes remains the sole orchestrator

V0.2 is market intelligence, not investment execution.
