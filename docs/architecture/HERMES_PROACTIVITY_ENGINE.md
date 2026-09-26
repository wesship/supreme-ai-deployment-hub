# Hermes Proactivity Engine / Watchtower

## Purpose

The Hermes Proactivity Engine adds a bounded observation loop to D3VONN.IO.
It continuously evaluates the existing Hermes task ledger for conditions that
deserve operator attention and converts them into auditable proposals.

Version 1 is intentionally **proposal-only**.

It does not dispatch agents, retry tasks, cancel work, deploy software, move
funds, send messages, call external connectors, or perform production actions.

## Loop

```text
Hermes task ledger
      |
      v
Watchtower snapshot
      |
      +-- stalled RUNNING tasks
      +-- FAILED tasks
      +-- aged PENDING tasks
      +-- possible duplicate active work
      |
      v
deterministic candidate scoring
      |
      v
stable correlation fingerprint
      |
      +-- already proposed -> reuse / no duplicate
      |
      v
MANUAL_REVIEW proactive_proposal task
      |
      v
existing human approval / Hermes control plane
```

## Safety invariants

- Proposals are written directly in `MANUAL_REVIEW`, never `PENDING`.
- The Watchtower never calls the Hermes dispatcher.
- Every proposal has a deterministic correlation ID.
- Re-running a cycle is idempotent for the same detected condition.
- A0 is observe-only even if a caller requests persistence.
- The background loop is disabled unless
  `HERMES_PROACTIVITY_ENABLED=true`.
- The implementation introduces no new database table or external connector.

## API

Authenticated Operator Command Center access is required.

- `GET /api/hermes/proactivity/status`
- `POST /api/hermes/proactivity/cycle`

Request:

```json
{"dry_run": true}
```

Use a dry run to inspect candidates without writing proposal tasks.

## Environment

- `HERMES_PROACTIVITY_ENABLED=false` (default)
- `HERMES_PROACTIVITY_AUTONOMY_LEVEL=A1`
- `HERMES_PROACTIVITY_INTERVAL_SECONDS=300`
- `HERMES_PROACTIVITY_STALE_SECONDS=1800`
- `HERMES_PROACTIVITY_PENDING_SECONDS=3600`
- `HERMES_PROACTIVITY_MAX_SCAN=200`
- `HERMES_PROACTIVITY_MAX_PROPOSALS=25`

The runtime clamps all numeric values to bounded safe ranges.

## Autonomy levels

The contract reserves A0-A5 so later phases can expand deliberately:

- A0 — observe
- A1 — recommend
- A2 — draft
- A3 — reversible
- A4 — guarded
- A5 — domain autonomous

**Current enforcement:** A0 never persists; A1-A5 may persist proposals only.
No level enables execution in this version.

## Promotion path

A future execution-capable release should be separate from this PR and must
bind each action class to the existing Hermes workflow approval service,
tool permissions, idempotency keys, checkpoint/recovery, and audit evidence.
