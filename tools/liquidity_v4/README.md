# D3VONN Uniswap V4 fork harness

This Foundry project is **test-only**. It must never be used with a production signer, a wallet secret, `cast send`, or a broadcast-capable Foundry script.

## Pinned upstream dependencies

```bash
cd tools/liquidity_v4
forge install foundry-rs/forge-std@886b4f8b63409ef474542de6394d25a9b5908ed3 --no-commit
forge install Uniswap/v4-core@46c6834698c48bc4a463a86d8420f4eb1d7f3b75 --no-commit
forge install Uniswap/v4-periphery@dce236d4e2057422d0791d9a973a58765eb46f65 --no-commit
```

The Base contract addresses remain pinned to Uniswap's official chain-8453 deployment manifest:

- PoolManager: `0x498581ff718922c3f8e6a244956af099b2652b2b`
- PositionManager: `0x7c5f5a4bbd8fd63184577525326123b519429bdc`
- StateView: `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## V0.5 certification path

The trusted path is `.github/workflows/liquidity-v4-simulation-certification.yml`.

Pull requests run only the preflight gate: pinned dependency installation, Solidity compilation, certificate-schema self-test, and a no-signing/no-broadcast policy scan. A real fork lifecycle can run only through explicit `workflow_dispatch` in the protected `production` environment.

A dispatched certification supplies public chain identifiers plus existing Hermes ownership identifiers:

- PoolId and complete sorted ERC-20/ERC-20 PoolKey
- pinned Base fork block
- simulation tick range
- Safe smart-account address to impersonate **only inside the fork**
- existing Hermes user UUID and goal UUID
- deterministic limits such as gas ceiling and simulated liquidity size

No private key, mnemonic, signature, or production transaction is an accepted input.

The workflow sets a short proposal deadline, forks Base at the supplied block, funds the Safe address only with Foundry cheatcodes, grants approvals only in the fork, and runs:

1. mint;
2. increase liquidity;
3. decrease liquidity;
4. collect;
5. complete exit.

The harness requires the final position liquidity to return to zero and every operation to remain under the configured gas ceiling.

## Machine-readable evidence

A passing lifecycle writes `reports/raw-simulation-report.json`. `certify_report.py` normalizes that report and refuses certification unless the chain, PoolId shape, PoolKey ordering, Safe address, gas invariants, final exit, canonical PositionManager target, deadline, and execution locks all pass.

It then emits:

- `reports/certification-envelope.json`
- `reports/safe-proposal-draft.json`

The certificate contains the full simulation report, its canonical SHA-256 digest, immutable GitHub runner identity, and a non-submittable Safe draft. GitHub's provenance action attests the exact certificate file. `persist_checkpoint.py` verifies that attested file digest, verifies the Hermes goal/user pair, and writes the passing envelope idempotently to the existing `hermes_checkpoints` table.

The backend re-checks the integrity chain before reconstructing a Safe draft:

```text
simulation report
      ↓ SHA-256
certificate envelope
      ↓ canonical object SHA-256
Hermes checkpoint
      ↓ exact file SHA-256
GitHub provenance attestation
      ↓
fresh StateView + PoolId + PoolKey validation
      ↓
non-submittable Safe proposal draft
```

A certificate is rejected if it is tampered, unpersisted, stale by Base block age, expired by proposal deadline, attached to the wrong PoolId or PoolKey, from the wrong GitHub run/repository, or targets anything other than the canonical Base V4 PositionManager.

## API proposal reference

After a passing certificate has been persisted, a V4 `propose_safe_transaction` request must include metadata identifying the exact Hermes checkpoint:

```json
{
  "certificate_goal_id": "<uuid>",
  "certificate_execution_id": "liquidity-v4-<run-id>",
  "certificate_sequence": 1,
  "max_certificate_block_age": 900
}
```

The returned draft is preparation evidence only. It explicitly keeps:

```text
submission_enabled = false
signing_enabled = false
broadcast_enabled = false
production_execution_enabled = false
```

It also marks allowance setup, fresh on-chain re-verification, and human/multisig approval as required before any later execution gate.
