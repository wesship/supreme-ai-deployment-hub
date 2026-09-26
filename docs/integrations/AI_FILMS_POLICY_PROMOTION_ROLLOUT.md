# AI Films Policy Promotion Rollout — Gate 19

Gate 19 adds a controlled rollout validation ledger after Gate 18 independent approval.

## Contract

Endpoint:

`POST /api/ai-films/policy-promotions/{change_request_id}/rollouts`

Requirements:
- caller must be authenticated;
- an approved Gate 18 review must exist;
- reviewer must differ from the original requestor;
- the approved adjustment remains bounded to `-5..+5`;
- production requests require a separate explicit authorization value;
- only a SHA-256 hash of that authorization value is persisted;
- authenticated browser clients can read rollout records but cannot insert/update/delete them directly.

## Reversible snapshot

Each rollout record stores:
- `pre_change_config`
- exact `approved_delta`
- `post_change_config`
- `rollback_config`
- executor and environment
- rollout status
- whether the effective runtime changed.

## Current Gate 19 execution semantics

This gate is intentionally non-executing with respect to live process environment and provider activation. It validates and persists the exact reversible change plan and returns:

- `runtime_changed: false`
- `production_applied: false`
- `rollback_ready: true`

This avoids falsely treating a database ledger write as a live Railway/runtime configuration mutation. A future production executor must consume only an independently approved Gate 19 rollout and must perform a bounded atomic change with health verification and rollback.

The migration was applied to staging only. No production routing or provider activation was changed.