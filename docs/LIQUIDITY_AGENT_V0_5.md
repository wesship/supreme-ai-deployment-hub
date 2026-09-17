# D3VONN Liquidity Agent V0.5 — Trusted Simulation Certification

## Gate objective

V0.5 converts the V0.4 fork plan into auditable evidence without crossing the custody boundary. A passing Uniswap V4 PositionManager lifecycle may be certified, provenance-attested, persisted to Hermes, and later used to reconstruct a **non-submittable** Safe proposal draft.

V0.5 does **not** enable production signing, transaction broadcast, autonomous approvals, or fund movement.

## State machine

```text
V4 StateView verification
        ↓
pinned Base fork
        ↓
PoolKey → PoolId assertion
        ↓
PositionManager lifecycle simulation
        ↓
report invariants PASS
        ↓
canonical report SHA-256
        ↓
certificate envelope
        ↓
GitHub provenance attestation
        ↓
Hermes goal/user ownership check
        ↓
idempotent hermes_checkpoints persistence
        ↓
fresh backend StateView verification
        ↓
certificate + attestation digest verification
        ↓
Safe proposal draft preparation
```

Any failure stops before proposal preparation.

## Trusted workflow

Workflow: `.github/workflows/liquidity-v4-simulation-certification.yml`

### Pull request mode

PRs execute preflight only:

- pinned Foundry installation;
- pinned `forge-std`, `v4-core`, and `v4-periphery` revisions;
- Solidity harness compilation;
- certificate schema self-test;
- scanner proving no production signing/broadcast credential path was introduced.

### Certification mode

A real certification requires `workflow_dispatch` and the protected `production` environment. Inputs are public chain/configuration identifiers plus existing Hermes UUIDs. The workflow does not accept a wallet secret.

The fork actor is the supplied Safe address, impersonated only through Foundry cheatcodes. ERC-20 balances and approvals exist only in the local fork.

## Passing report requirements

`tools/liquidity_v4/test/D3VONNLiquidityV4Fork.t.sol` must pass all of the following:

- Base chain ID = 8453;
- PoolKey recomputes to the expected PoolId using Uniswap's official `PoolIdLibrary`;
- canonical StateView and PositionManager resolve to the pinned PoolManager;
- pool is initialized and current tick is inside the proposed range;
- currencies are sorted ERC-20/ERC-20 addresses;
- mint succeeds;
- increase succeeds;
- decrease succeeds;
- collect preserves position liquidity;
- complete exit returns position liquidity to zero;
- every operation remains below the configured gas ceiling;
- candidate transaction targets the canonical Base V4 PositionManager;
- candidate ETH value is zero;
- execution flags remain false for private-key access, signing, broadcast, and production execution.

A passing harness emits `raw-simulation-report.json` containing the exact simulated mint calldata used to build the candidate Safe draft.

## Certificate integrity

`tools/liquidity_v4/certify_report.py` normalizes Foundry's raw serialization and creates a canonical certificate only if every report invariant passes.

The integrity chain is:

1. canonical simulation report SHA-256;
2. canonical certificate-object SHA-256;
3. exact canonical certificate-file SHA-256, including its terminating newline;
4. GitHub provenance attestation of that exact file;
5. Hermes checkpoint embedding the certificate and attestation metadata.

`backend/liquidity_agent/certification.py` recomputes these hashes before accepting a certificate reference. It also requires the GitHub repository, run ID, and commit SHA recorded in the attestation metadata to match the runner identity embedded in the certificate.

## Hermes persistence

`tools/liquidity_v4/persist_checkpoint.py` uses the existing `hermes_checkpoints` table. It does not create a parallel ledger.

Before insertion it requires:

- valid Hermes user and goal UUIDs;
- an existing `hermes_goals` row matching both IDs;
- a passing certificate;
- exact GitHub attestation URL prefix for this repository;
- attested subject digest matching the certificate file;
- deterministic execution ID and sequence.

Checkpoint title:

```text
workflow:<execution_id>:checkpoint:<20-digit sequence>
```

Persistence is idempotent. Re-running with identical content succeeds; a different certificate attempting to reuse the same deterministic checkpoint title is rejected.

## Safe proposal preparation

The V4 API still performs fresh canonical StateView verification before loading the certificate. A `propose_safe_transaction` action must include:

```json
{
  "metadata": {
    "certificate_goal_id": "<uuid>",
    "certificate_execution_id": "liquidity-v4-<github-run-id>",
    "certificate_sequence": 1,
    "max_certificate_block_age": 900
  }
}
```

The certificate is rejected when:

- not persisted;
- report or certificate content is tampered;
- attestation digest does not bind to the embedded certificate;
- repository/run/SHA identity does not match;
- PoolId or supplied PoolKey does not match;
- fork block is too old relative to fresh Base state;
- proposal deadline expired;
- candidate target is not the canonical PositionManager;
- candidate value is non-zero;
- any execution lock is enabled.

A passing response may return `safe_proposal_draft_ready`, but the draft always includes:

```text
requires_human_or_multisig_approval = true
requires_allowance_preconditions = true
requires_onchain_reverification_before_submission = true
submission_enabled = false
signing_enabled = false
broadcast_enabled = false
production_execution_enabled = false
```

## Custody boundary

V0.5 never receives or stores a production private key or mnemonic. The AI/Hermes layer cannot sign or broadcast. GitHub Actions only produces simulation evidence and Hermes persistence. Any future movement of real funds requires a separate reviewed execution gate.

## Next gate

V0.6 should add Safe transaction-service **draft submission only** behind a human approval queue, re-simulation freshness checks, explicit token-allowance planning, and an immutable audit record. Signing and final broadcast should remain outside the AI agent unless a later governance decision explicitly creates a separately controlled execution service.
