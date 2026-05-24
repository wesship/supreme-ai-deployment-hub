# Staging Runtime Activation Runbook

## Purpose

This runbook defines the minimum live-staging activation sequence required before Devonn.ai can be treated as production-ready autonomous infrastructure.

## Activation Goal

Prove that staging can run, fail, recover, and expose telemetry without corrupting execution lineage.

## Required Staging Components

- frontend deployment
- API deployment
- scheduler or orchestrator deployment
- worker runtime
- queue backend
- database backend
- metrics endpoint
- telemetry collector
- dashboard surface

## Required Runtime Signals

- queue_depth
- retry_scheduled_total
- stale_detected_total
- dlq_routed_total
- replay_rejected_total
- escalation_triggered_total
- worker_heartbeat_age
- scheduler_lag_ms

## Required Drill 1: Worker Crash Recovery

1. Create a staging execution envelope.
2. Claim task with a staging worker.
3. Start execution.
4. Stop worker heartbeat.
5. Wait for lease expiry.
6. Mark execution as STALE.
7. Validate replay safety.
8. Retry or escalate.
9. Verify telemetry contains full lineage.

Success criteria:

- no duplicate completion
- lineage_id preserved
- correlation_id preserved
- stale event emitted
- retry or escalation event emitted
- metrics updated

## Required Drill 2: Retry Ceiling and DLQ

1. Force repeated execution failure.
2. Verify retry_count increments.
3. Verify max_retries is enforced.
4. Verify DLQ routing.
5. Verify forensic metadata is preserved.

Success criteria:

- no infinite retries
- DLQ event emitted
- failure reason preserved
- manual review is possible

## Required Drill 3: Replay Rejection

1. Create replay hash.
2. Corrupt replay lineage or hash.
3. Validate replay safety.
4. Confirm escalation instead of blind retry.

Success criteria:

- unsafe replay rejected
- escalation emitted
- original lineage preserved

## Required Drill 4: Rollback Visibility

1. Deploy staging candidate.
2. Record deployment_version.
3. Execute runtime task.
4. Roll back candidate.
5. Verify telemetry still shows deployment lineage.

Success criteria:

- deployment_version visible in events
- rollback target known
- runtime lineage preserved

## Go / No-Go Criteria

Staging is not ready for production promotion unless:

- worker crash recovery succeeds
- retry ceiling works
- DLQ visibility works
- replay rejection works
- metrics endpoint works
- tracing pipeline works or has a documented substitute
- rollback lineage is visible
