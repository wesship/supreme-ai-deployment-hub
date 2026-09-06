# D3VONN Liquidity Pool Agent V0.3

## Gate objective

V0.3 turns a screened Base/Uniswap V3 pool candidate into a canonically verified,
read-only state snapshot and a reproducible Foundry/Anvil fork plan.

It does **not** sign, broadcast, approve tokens, add/remove liquidity, swap, rebalance,
or move production funds.

## Pipeline

```text
DefiLlama candidate
        |
        v
D3VONN policy firewall
        |
        v
Base read-only RPC
        |
        +--> eth_chainId
        +--> eth_blockNumber
        +--> eth_getCode
        +--> eth_call only
        |
        v
Uniswap V3 pool reads
        |
        +--> factory()
        +--> token0()
        +--> token1()
        +--> fee()
        +--> tickSpacing()
        +--> liquidity()
        +--> slot0()
        |
        v
Canonical Base V3 factory getPool(token0, token1, fee)
        |
        +--> must equal candidate pool address
        |
        v
Optional explicitly configured V3 history indexer
        |
        +--> poolDayDatas
        +--> TVL / volume / fees / liquidity / tick
        |
        v
Range planner
        |
        v
Pinned Foundry / Anvil fork plan
        |
        v
NO SIGNING / NO BROADCAST / NO FUND MOVEMENT
```

## Canonical verification

Base Uniswap V3 factory:

`0x33128a8fC17869897dcE68Ed026d694621f6FDfD`

A pool is not treated as verified merely because a third-party data provider returns
an address. V0.3 requires all of the following:

1. RPC chain ID is Base (`8453`).
2. The candidate address contains contract bytecode.
3. `factory()` equals the canonical Base Uniswap V3 factory.
4. `token0()`, `token1()`, `fee()`, `tickSpacing()`, `liquidity()`, and `slot0()` decode.
5. The canonical factory's `getPool(token0, token1, fee)` returns the same pool address.
6. Candidate fee-tier / underlying-token metadata, when supplied, agrees with chain state.
7. Current in-range pool liquidity is greater than zero.
8. The pool reports its lock flag as unlocked before a simulation plan is produced.

## V4 boundary

Uniswap V4 is intentionally **not** passed through the V3 pool ABI. V4 stores pool state
behind `PoolManager` and is read through `StateView` / `StateLibrary` patterns. A dedicated
V4 StateView verifier is a separate gate.

V0.3 therefore keeps:

```text
Uniswap V3: canonical verification enabled
Uniswap V4: discovery/risk research only
```

## Historical indexing

V0.3 supports the Uniswap V3 `PoolDayData` schema for:

- daily liquidity
- sqrt price
- token prices
- tick
- TVL
- daily volume
- daily fees
- daily transaction count

The service calculates observed-window summaries:

- average TVL
- total volume
- total observed fees
- fee / average-TVL basis points
- annualized fee / average-TVL percentage

The annualized metric is a mathematical normalization of observed historical fees. It is
not a forecast, guaranteed APY, or recommendation.

D3VONN does not silently select or trust a third-party subgraph deployment. Historical
indexing is enabled only when an operator explicitly supplies either a reviewed GraphQL
endpoint or both a Graph gateway API key and reviewed subgraph deployment ID.

If the Graph indexer is unavailable, the agent can still expose the DefiLlama
`volume_7d_usd` and `apy_mean_30d` fields as fallback research signals.

## Server-side configuration

Required for canonical on-chain verification:

```bash
LIQUIDITY_BASE_RPC_URL=
```

`BASE_RPC_URL` remains a compatibility fallback.

Optional historical indexer configuration:

```bash
# Option A: operator/self-hosted or otherwise reviewed GraphQL endpoint
LIQUIDITY_UNISWAP_V3_SUBGRAPH_URL=

# Option B: The Graph gateway with an explicitly reviewed deployment ID
LIQUIDITY_THE_GRAPH_API_KEY=
LIQUIDITY_UNISWAP_V3_SUBGRAPH_ID=

# THE_GRAPH_API_KEY= is accepted as a compatibility fallback for the API key only.
# A deployment ID is still required.
```

No RPC URL, Graph key, or subgraph deployment ID is accepted from the public request API,
and no credential is returned in API responses.

## API

### Health

`GET /api/liquidity/health`

V0.3 health reports:

- DefiLlama discovery status
- Base RPC configuration status
- V3 historical indexer configuration status
- V3 canonical verifier enabled
- V4 verifier not enabled
- Foundry plan generation enabled
- live execution disabled

### Discover

`GET /api/liquidity/pools?chain=base&protocol=uniswap-v3&limit=10`

Returns screened provider candidates. Discovery alone is not canonical verification.

### Verify selected pool

`POST /api/liquidity/verify`

The request uses the normal `LiquidityRequest` schema and must include a concrete
`pool.pool_address` (or a 42-character address-valued `pool_id`).

The endpoint forces the action to `verify_pool_state`.

### Historical analysis

`POST /api/liquidity/history`

The endpoint first verifies the selected pool canonically, then loads explicitly configured
historical data.

### Fork plan

`POST /api/liquidity/simulation-plan`

The endpoint verifies the selected pool and produces a range plus a pinned Anvil command
using the current verified Base block number.

Example conceptual output:

```text
anvil
  --fork-url $LIQUIDITY_BASE_RPC_URL
  --fork-block-number <verified block>
  --chain-id 8453
```

The generated plan includes only readback `cast call` operations until a dedicated local
PositionManager test harness is added.

## Range planning

The V0.3 range planner:

1. starts from the verified current tick;
2. converts requested half-width basis points into approximate tick distance;
3. snaps lower/upper ticks to the pool's canonical tick spacing;
4. clamps to valid Uniswap V3 tick bounds;
5. rejects collapsed ranges.

Default requested half width: `500 bps` (approximately 5% on either side).

Request field:

```text
range_half_width_bps
```

Allowed range:

```text
50 .. 5000
```

## Safety invariants

These are immutable V0.3 response defaults:

```text
live_execution_enabled = false
private_key_access = false
broadcast_enabled = false
```

The generated fork plan also contains:

```text
signing_enabled = false
production_execution_enabled = false
```

No API accepts:

- a private key
- seed phrase
- signer
- arbitrary JSON-RPC method
- transaction broadcast flag
- arbitrary remote pool-data URL
- Graph API key
- subgraph deployment ID

## Gate exit criteria

V0.3 can be marked GREEN only after:

- unit tests pass;
- API contract tests pass;
- CodeQL passes;
- Gitleaks passes;
- hardened build/security gates pass;
- Final Green Check passes;
- PR is mergeable;
- the V0.2 dependency is merged first.

## Next gate

V0.4 should add:

1. dedicated Uniswap V4 `StateView` verification;
2. a local PositionManager Foundry harness;
3. fork execution of mint/increase/decrease/collect scenarios using test-only funded
   accounts;
4. explicit balance/slippage/gas/revert invariants;
5. persisted simulation reports and Hermes checkpoints.

Production signing and broadcasting remain outside that gate.
