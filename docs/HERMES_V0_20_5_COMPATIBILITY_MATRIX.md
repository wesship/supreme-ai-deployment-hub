# D3VONN.IO — Hermes v0.20.5 Compatibility Matrix

## Purpose

Validate the upstream Nous Research Hermes Agent `v0.20.5 / v2026.8.19` as an execution/runtime layer without replacing the D3VONN Hermes control plane.

## Required invariants

- `backend/hermes` remains the canonical D3VONN control plane.
- `/api/hermes/tasks/*` remains the authenticated task API.
- Supabase Hermes brain/runtime-ledger persistence remains authoritative for D3VONN task state.
- Redis/worker leases remain owned by D3VONN workers.
- Agent registry and policy/security gates remain upstream of execution.
- AI Films Hermes bridges continue to receive D3VONN task lifecycle events.
- The upstream runtime is pinned to `v2026.8.19` until compatibility tests pass.

## Test gates

| Gate | Pass condition |
|---|---|
| Version | `hermes --version` reports `0.20.5` |
| Config | `hermes config check` exits successfully |
| Task contract | Create → LOCKED → RUNNING → COMPLETED works through D3VONN task engine |
| Failure contract | Runtime failure transitions task to FAILED and records the error |
| Lease safety | Two workers cannot execute the same leased task concurrently |
| Recovery | Restarted worker can recover an unfinished lease without duplicating completed work |
| Agent routing | TARS/ION/SAPPHIRE/GUARDIAN routing remains controlled by D3VONN registry/policy |
| Memory | D3VONN Hermes memory/runtime ledger remains readable and writable |
| AI Films | Terminal task transitions continue to advance the AI Films bridge |
| Security | Upstream runtime cannot bypass D3VONN auth/policy boundaries |
| Observability | Hermes worker events remain visible in existing logs/telemetry |

## Rollout order

1. Install the pinned upstream runtime in its isolated environment.
2. Run version/config checks.
3. Run the D3VONN compatibility suite against staging.
4. Verify task, lease, recovery, memory, policy and AI Films gates.
5. Only after all gates pass, expose the upstream runtime through a D3VONN adapter.
6. Keep the existing `d3vonn-hermes` worker available as the rollback path.

## Rollback

Rollback means disabling the upstream adapter and returning execution to the existing D3VONN Hermes worker. Do not delete D3VONN Hermes state or replace the control plane during a failed compatibility test.
