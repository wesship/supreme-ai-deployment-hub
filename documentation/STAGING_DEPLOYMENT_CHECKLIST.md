# Staging Deployment Checklist

## Purpose

This checklist defines the first live staging rollout sequence for D3VONN.

The goal is to prove the platform can deploy, expose health, emit telemetry, recover tasks, and preserve runtime lineage before production promotion.

## Pre-Deployment Requirements

- CI validation is passing
- promotion validation is passing
- terraform validation is passing when infrastructure files change
- secrets governance is documented
- staging environment variables are configured
- runtime recovery tests pass
- rollback target is known

## Required Staging Secrets

Configure in the appropriate platform, never in source code:

- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- ENCRYPTION_KEY
- DEPLOYMENT_VERSION
- VITE_API_URL
- VITE_ENVIRONMENT
- VERCEL_TOKEN if using Vercel deployment automation
- VERCEL_ORG_ID if using Vercel deployment automation
- VERCEL_PROJECT_ID if using Vercel deployment automation
- OTEL_EXPORTER_OTLP_ENDPOINT if tracing is enabled

## Deployment Order

1. Deploy database staging branch.
2. Deploy Redis staging queue.
3. Deploy API service.
4. Deploy worker runtime.
5. Deploy scheduler or orchestrator runtime.
6. Deploy frontend staging build.
7. Enable metrics endpoint.
8. Enable telemetry sink.
9. Confirm dashboard visibility.

## Health Checks

Verify:

- API /health returns healthy
- API /ready returns ready
- API /version exposes deployment version
- API /metrics exposes runtime metrics
- worker heartbeat is visible
- queue depth is visible
- retry metrics are visible
- DLQ metrics are visible

## First Runtime Drill

Run the worker crash recovery drill:

1. Create a staging task.
2. Claim the task with a worker.
3. Start execution.
4. Stop the worker.
5. Wait for lease expiry.
6. Confirm stale detection.
7. Validate replay safety.
8. Retry or escalate.
9. Confirm telemetry lineage.

## Go Criteria

Staging can move forward if:

- no duplicate execution occurs
- retry ceiling works
- DLQ routing works
- replay rejection works
- metrics are visible
- logs are visible
- lineage is visible
- rollback target is known

## No-Go Criteria

Do not promote if:

- queue state is invisible
- replay lineage is missing
- duplicate execution occurs
- retry loop is unbounded
- stale recovery fails
- DLQ events are hidden
- rollback target is unknown
- telemetry is incomplete

## Production Promotion Rule

Production promotion is blocked until staging passes the recovery drill and observability validation under live hosted conditions.
