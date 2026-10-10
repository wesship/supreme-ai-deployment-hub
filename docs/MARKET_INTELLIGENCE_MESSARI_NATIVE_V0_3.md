# D3VONN Market Intelligence Hub v0.3 — Native Messari

## Objective

Use Messari's official read-only API directly for crypto market intelligence while preserving Hermes Research OS as the ranking, synthesis, and DKOS persistence layer.

## Runtime configuration

```env
MESSARI_MARKET_INTELLIGENCE_ENABLED=true
MESSARI_API_KEY=<server-side Messari API key>
```

No Messari credential is exposed to the browser. The API key is sent only in the `x-messari-api-key` request header from the backend.

## Official endpoint

The v0.3 adapter is pinned to:

`GET https://api.messari.io/metrics/v2/assets/details`

The URL is not user-controlled and redirects are disabled.

## Data flow

Messari official API (GET only)
→ normalize to `MarketSignal`
→ Hermes Research OS `EvidenceRankerAgent`
→ synthesis
→ optional `DKOSMemoryWriterAgent`
→ `/market-intelligence` dashboard

## Safety invariants

- read-only HTTP GET only
- no orders or brokerage/exchange execution
- no wallet signing
- no transaction broadcast
- no private keys or mnemonics
- no x402/payment execution
- no user-controlled provider URL
- Messari API key is server-side only

## Activation checkpoint

Production activation is intentionally configuration-gated. Until `MESSARI_API_KEY` is present on the Railway `devonn-ai-api` production service, Messari reports `configured=false` and no live request is attempted.
