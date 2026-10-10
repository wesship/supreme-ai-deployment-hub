# D3VONN Liquidity Pool Agent V0.2 — Read-Only Intelligence

## Gate objective

V0.2 turns the V0.1 simulation/proposal scaffold into a live read-only intelligence service. It may retrieve public market/on-chain data, normalize it, screen it under deterministic policy, score candidates, and return ranked pools to Hermes.

It still cannot sign, broadcast, approve, swap, deposit, withdraw, rebalance, or move funds.

## API

### `GET /api/liquidity/health`

Reports the V0.2 mode and whether an optional Base RPC URL is configured. The RPC URL itself is never returned.

### `GET /api/liquidity/pools`

Query parameters:

- `chain`: defaults to `base`
- `protocol`: defaults to `uniswap-v3`
- `limit`: 1–50, defaults to 10

The endpoint fetches DefiLlama yield-pool data, normalizes pool records, applies D3VONN TVL/volume/outlier screens, calculates a deterministic simulation-readiness score, and returns ranked candidates.

### `POST /api/liquidity/run`

`discover_pools` uses the live read-only path. Other actions retain the V0.1 deterministic simulation/proposal behavior.

## Data sources

### DefiLlama Yield Server

Fixed endpoint:

`https://yields.llama.fi/pools`

No user-supplied remote URL is accepted. V0.2 consumes the current public pool schema including TVL, base/reward APY, 1d/7d volume, 30d APY mean, IL risk, exposure, underlying tokens, outlier status, pool/project/chain metadata, and stablecoin flag.

### Base RPC freshness probe

Optional environment variable:

`LIQUIDITY_BASE_RPC_URL`

Fallback environment variable:

`BASE_RPC_URL`

Only these JSON-RPC methods are allowed by the V0.2 adapter:

- `eth_chainId`
- `eth_blockNumber`

No arbitrary method is accepted from API callers. The RPC adapter exposes no signing, account unlock, transaction send, raw transaction, approval, trace, or wallet method.

Expected Base chain ID: `8453`.

## Screening policy

V0.2 inherits the V0.1 policy firewall:

- approved chain: Base
- approved protocols: Uniswap v3 and Uniswap v4
- max proposed position: $25,000
- max slippage: 100 bps
- minimum pool TVL: $250,000
- minimum observed 24h volume: $50,000 when volume is available
- provider-marked outliers are excluded from discovery

This screen is a safety/research filter, not financial advice or a guarantee of pool quality.

## Risk score

The deterministic score considers:

- pool TVL
- recent 24h volume
- reward APY extremes
- deviation from 30-day APY mean
- provider outlier flag
- provider IL-risk flag
- stablecoin pool flag

A score of 60+ means only `approved_for_simulation`. It never authorizes live execution.

## Non-custodial invariant

Every V0.2 `LiquidityResponse` keeps:

```text
live_execution_enabled = false
private_key_access = false
broadcast_enabled = false
```

The live discovery payload also states:

```text
signing = false
fund_movement = false
```

## Next gate

V0.3 should add verified Uniswap pool-state enrichment and historical fee/liquidity indexing (Graph/subgraph or a vetted indexer), then generate Foundry/Anvil fork-simulation plans for selected candidates. Safe remains proposal-only.
