# Runtime Recovery and Queue Resilience Contract

## Purpose

This document defines the production reliability contract for D3VONN autonomous runtime execution.

The goal is to prevent silent task loss, retry storms, duplicate execution, stale worker ownership, and replay corruption.

## Canonical Execution States

All queue-backed work should map to these states:

- PENDING
- LOCKED
- RUNNING
- RETRY
- PAUSED
- MANUAL_REVIEW
- ESCALATED
- FAILED
- COMPLETED
- STALE
- QUARANTINED

## Required Runtime Metadata

Every task execution should preserve:

- task_id
- execution_id
- lineage_id
- correlation_id
- retry_count
- max_retries
- scheduler_owner
- worker_owner
- lease_expires_at
- last_heartbeat_at
- replay_hash where applicable
- idempotency_key where applicable

## Retry Governance

Retry behavior must be bounded.

Recommended policy:

- attempt 1: retry with short backoff
- attempt 2: retry with longer backoff
- attempt 3: escalate
- attempt 4: manual review or quarantine

No task should retry indefinitely.

## Stale Recovery

A task becomes stale when:

- lease expiration is exceeded
- worker heartbeat is missing
- scheduler owner is unavailable
- max runtime is exceeded

Recovery process:

1. mark execution as STALE
2. verify idempotency safety
3. verify replay safety
4. requeue only when safe
5. escalate when safety is uncertain

## Duplicate Execution Prevention

Every task should use an idempotency key or equivalent dedupe mechanism.

Duplicate execution should be rejected when:

- the same idempotency key is already completed
- a valid lease is still active
- replay lineage is inconsistent

## Dead-Letter Management

Tasks should route to a dead-letter queue when:

- retry ceiling is exceeded
- replay safety is uncertain
- idempotency cannot be verified
- governance policy blocks execution
- external integration repeatedly fails

Dead-letter events should include enough metadata for manual review.

## Circuit Breakers

Runtime circuit breakers should activate for:

- retry storm
- dead-letter growth
- queue saturation
- scheduler lag
- stale execution spike
- replay mismatch
- telemetry outage

Circuit breaker actions may include:

- throttle task intake
- pause replay
- isolate worker
- escalate to manual review
- block production promotion

## Observability Requirements

The runtime should emit metrics for:

- queue_depth
- retry_rate
- dead_letter_count
- stale_execution_count
- scheduler_lag_ms
- worker_heartbeat_age
- replay_mismatch_count
- duplicate_rejection_count

## Production Readiness Rule

D3VONN should not scale autonomous execution until retry caps, stale recovery, dedupe, dead-letter routing, and replay visibility are implemented and observable.
