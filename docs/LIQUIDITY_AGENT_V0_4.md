# D3VONN Liquidity Pool Agent V0.4

## Gate objective

V0.4 adds canonical **Base Uniswap V4 StateView verification** and a **fork-only PositionManager lifecycle harness** while preserving the non-custodial simulation boundary.

Production signing, broadcasting, approvals, swaps, liquidity changes, and fund movement remain disabled by the D3VONN API.

## Official Base deployment pins

The verifier and harness use the official Uniswap `contracts/deployments/json/8453.json` deployment manifest:

- PoolManager: `0x498581ff718922c3f8e6a244956af099b2652b2b`
- PositionManager: `0x7c5f5a4bbd8fd63184577525326123b519429bdc`
- StateView: `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

The upstream Foundry harness instructions pin reviewed commits of `v4-core`, `v4-periphery`, and `forge-std`.

## Canonical StateView verification

For a supplied V4 `PoolId`, D3VONN performs only these production RPC method families:

```text
eth_chainId
eth_blockNumber
eth_getCode
eth_call
```

The verifier requires:

1. chain ID = Base (`8453`);
2. bytecode at canonical StateView, PoolManager, and PositionManager;
3. `StateView.poolManager()` = canonical PoolManager;
4. `PositionManager.poolManager()` = canonical PoolManager;
5. `StateView.getSlot0(poolId)` decodes successfully;
6. `sqrtPriceX96 > 0`, proving the PoolId is initialized;
7. `StateView.getLiquidity(poolId)` decodes successfully.

The V4 verifier never exposes arbitrary JSON-RPC methods and never calls a state-changing RPC method.

## PoolId / PoolKey boundary

V4 defines:

```text
PoolId = keccak256(abi.encode(PoolKey))
```

D3VONN intentionally does **not** implement Ethereum Keccak/PoolKey hashing in Python merely for this gate. The backend accepts an explicit 32-byte PoolId for read-only StateView verification.

Before any fork mutation scenario, the Foundry harness recomputes the PoolId using Uniswap's official Solidity `PoolIdLibrary.toId(poolKey)` and asserts equality with the expected PoolId.

This gives us:

```text
Python API: read-only PoolId verification
Foundry fork: cryptographic PoolKey -> PoolId identity check
```

without introducing a custom cryptographic implementation into the backend.

## API

Existing protocol-aware endpoints now support `protocol=uniswap-v4`:

```text
POST /api/liquidity/verify
POST /api/liquidity/simulation-plan
POST /api/liquidity/run
```

Dedicated endpoints are also available:

```text
POST /api/liquidity/v4/verify
POST /api/liquidity/v4/simulation-plan
```

A V4 verification request must include:

```json
{
  "action": "verify_pool_state",
  "chain": "base",
  "protocol": "uniswap-v4",
  "pool": {
    "chain": "base",
    "protocol": "uniswap-v4",
    "pool_id": "0x<64 hex chars>"
  }
}
```

A mutation simulation plan also requires a complete `v4_pool_key`:

```json
{
  "currency0_address": "0x...",
  "currency1_address": "0x...",
  "fee": 3000,
  "tick_spacing": 60,
  "hooks_address": "0x0000000000000000000000000000000000000000"
}
```

## Fork-only PositionManager harness

Location:

```text
tools/liquidity_v4/
```

The harness:

1. forks Base at the exact block returned by canonical verification;
2. checks `PoolKey.toId()` equals the expected PoolId;
3. verifies StateView and PositionManager both use the canonical PoolManager;
4. verifies the current tick is inside the proposed range;
5. rejects native-currency mutation in V0.4;
6. creates a disposable test actor;
7. funds the actor using Foundry cheatcodes only;
8. makes Permit2/PositionManager approvals only inside the local fork;
9. mints a position;
10. increases liquidity;
11. decreases liquidity;
12. collects fees using zero-liquidity decrease semantics;
13. removes the remaining liquidity for a complete exit;
14. asserts position liquidity after each step;
15. enforces a configurable per-operation gas ceiling;
16. lets unexpected reverts fail the test;
17. never broadcasts.

Mutation tests require explicit `D3VONN_V4_MUTATION_TESTS=true`.

## Report and Hermes checkpoint boundary

The backend emits:

- a deterministic simulation-plan report schema;
- a `hermes_checkpoint_payload` describing the planned fork run;
- `persisted=false` on that payload.

That distinction is intentional. **A plan is not a completed simulation.** V0.4 does not mark a Hermes checkpoint as persisted until a trusted execution/persistence gate actually runs the harness, captures the report, and records the attested result.

Safe proposal construction for V4 therefore returns:

```text
proposal_blocked_until_simulation_report
```

until that later condition is met.

## Hard safety invariants

```text
live_execution_enabled = false
private_key_access = false
broadcast_enabled = false
production_execution_enabled = false
```

No D3VONN liquidity API request accepts:

- private key;
- seed phrase;
- signer;
- transaction broadcast flag;
- arbitrary RPC method;
- arbitrary StateView/PoolManager/PositionManager address.

## Gate exit criteria

V0.4 can be merged only after the repository's required CI matrix passes, including Python testing, API contracts, coverage, CodeQL, Gitleaks, security/hardened build, container hardening, and Final Green.

## Next gate

V0.5 should execute the pinned Foundry harness in a trusted runner, emit a machine-readable simulation report, persist its hash/result into the Hermes checkpoint system, and allow **Safe proposal preparation only after a passing attested simulation**. Production signing and broadcasting should remain disabled.
