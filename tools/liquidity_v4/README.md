# D3VONN Uniswap V4 fork harness

This Foundry project is **test-only**. It must never be used with `forge script --broadcast`, a production private key, or a production signer.

## Pinned upstream dependencies

Install the reviewed upstream revisions into this directory:

```bash
cd tools/liquidity_v4
forge install foundry-rs/forge-std@886b4f8b63409ef474542de6394d25a9b5908ed3 --no-commit
forge install Uniswap/v4-core@46c6834698c48bc4a463a86d8420f4eb1d7f3b75 --no-commit
forge install Uniswap/v4-periphery@dce236d4e2057422d0791d9a973a58765eb46f65 --no-commit
```

The Base contract addresses in the harness are pinned to Uniswap's official `contracts/deployments/json/8453.json` manifest:

- PoolManager: `0x498581ff718922c3f8e6a244956af099b2652b2b`
- PositionManager: `0x7c5f5a4bbd8fd63184577525326123b519429bdc`
- StateView: `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Required fork inputs

```bash
export LIQUIDITY_BASE_RPC_URL='https://...'
export D3VONN_V4_FORK_BLOCK='12345678'
export D3VONN_V4_POOL_ID='0x<64 hex chars>'
export D3VONN_V4_CURRENCY0='0x...'
export D3VONN_V4_CURRENCY1='0x...'
export D3VONN_V4_FEE='3000'
export D3VONN_V4_TICK_SPACING='60'
export D3VONN_V4_HOOKS='0x0000000000000000000000000000000000000000'
export D3VONN_V4_TICK_LOWER='-600'
export D3VONN_V4_TICK_UPPER='600'
```

Read-only canonical verification runs without enabling mutation:

```bash
forge test --root tools/liquidity_v4 --match-test test_readOnlyCanonicalState -vvv
```

Mutation tests require an explicit opt-in and are still local-fork-only:

```bash
export D3VONN_V4_MUTATION_TESTS=true
forge test --root tools/liquidity_v4 --match-test test_forkOnlyPositionLifecycle -vvv
```

Optional limits:

```bash
export D3VONN_V4_GAS_CEILING='3000000'
export D3VONN_V4_SEED_AMOUNT='1000000000000000000000000'
export D3VONN_V4_INITIAL_LIQUIDITY='1000000000000'
export D3VONN_V4_DELTA_LIQUIDITY='100000000000'
export D3VONN_V4_AMOUNT0_MAX='340282366920938463463374607431768211455'
export D3VONN_V4_AMOUNT1_MAX='340282366920938463463374607431768211455'
export D3VONN_V4_AMOUNT0_MIN='0'
export D3VONN_V4_AMOUNT1_MIN='0'
```

## Safety invariants

The harness:

1. creates a Base fork at the supplied block;
2. recomputes `PoolIdLibrary.toId(poolKey)` and requires it to equal the expected PoolId;
3. verifies StateView and PositionManager both point at the canonical PoolManager;
4. rejects native-currency mutation scenarios in V0.4;
5. funds a disposable actor only with Foundry cheatcodes;
6. approves ERC-20s only inside the local fork;
7. exercises mint, increase, decrease, collect, and full-liquidity exit;
8. checks position liquidity after each mutation;
9. checks per-operation gas ceilings;
10. allows unexpected reverts to fail the test;
11. never accepts a production private key and never broadcasts.

The backend emits a Hermes checkpoint payload for a simulation plan, but it marks that payload `persisted=false` until a trusted runner actually executes the harness and a later persistence gate records the signed/attested report. This prevents a plan from being mistaken for a completed simulation.
