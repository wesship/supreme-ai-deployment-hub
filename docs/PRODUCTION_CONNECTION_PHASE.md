# DEVONN.AI Production Connection Phase

## Objective

Transition the Operator OS from:
- production-architected

to:
- production-connected

## Current State

The Operator Console now contains:
- runtime streaming
- graph intelligence
- memory intelligence
- observability surfaces
- queue surfaces
- governance surfaces
- topology awareness

Most surfaces are currently synthetic placeholders.

## Production Connection Priorities

### Priority 1 — GitHub Actions
Goal:
- real CI state
- workflow health
- deployment gates

Required env:
- GH_TOKEN or GITHUB_TOKEN

### Priority 2 — Prometheus
Goal:
- real metrics
- API latency
- queue telemetry
- infra telemetry

Required env:
- PROMETHEUS_URL

### Priority 3 — Loki
Goal:
- real logs
- deployment logs
- runtime logs
- agent logs

Required env:
- LOKI_URL

### Priority 4 — OpenTelemetry
Goal:
- distributed traces
- runtime spans
- DAG tracing
- queue tracing

Required env:
- OTEL_EXPORTER_OTLP_ENDPOINT

### Priority 5 — Redis Queue Telemetry
Goal:
- real queue depth
- worker state
- retry visibility

Required env:
- REDIS_URL

### Priority 6 — Deployment Providers
Goal:
- live deployment state
- staging readiness
- production readiness

Providers:
- Vercel
- AWS
- Render
- Railway

## Security Rules

1. Read-only integrations first.
2. No automatic deployments.
3. No secret material exposed.
4. Manual review required for mutations.
5. Production execution disabled until governance approval.

## Future Evolution

### Phase 1
Read-only adapters.

### Phase 2
Live metrics/logs/traces.

### Phase 3
Authenticated operational controls.

### Phase 4
Human-approved remediation.

### Phase 5
Autonomous orchestration with governance.
