# Runtime Recovery Service

## Purpose

This service defines the minimum recoverable execution lifecycle for D3VONN autonomous runtime work.

It is intentionally small and conservative. The goal is to prove survivability before scaling autonomy.

## Core Guarantees

- every task has an execution envelope
- every execution has correlation and lineage metadata
- retries are bounded
- stale executions are recoverable
- unsafe replay escalates instead of re-running blindly
- dead-letter records preserve forensic metadata

## Minimum Lifecycle

```text
PENDING -> LOCKED -> RUNNING -> COMPLETED
RUNNING -> RETRY -> LOCKED
RUNNING -> STALE -> RETRY or ESCALATED
RETRY -> DLQ when max retries is exceeded
```

## First Recovery Drill

The first staging drill should simulate a worker dying while a task is RUNNING.

Success means:

- heartbeat stops
- lease expires
- execution becomes STALE
- lineage is preserved
- duplicate execution is blocked
- retry or escalation is deterministic
- telemetry can reconstruct the event
