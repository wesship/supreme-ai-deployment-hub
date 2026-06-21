# DEVONN.AI Staging Deployment Runbook

## Objective

Move the Operator OS from unified local/prototype command center into a real staging environment.

This runbook keeps staging safe, read-only, observable, and reversible.

## Current Platform Capabilities

The Operator OS now includes:

- authenticated Operator API
- frontend session gate
- Prometheus metrics adapter
- Loki logs adapter
- OpenTelemetry / Tempo / Jaeger traces adapter
- Redis queue telemetry adapter
- GitHub Actions telemetry adapter
- runtime WebSocket stream
- topology and DAG surfaces
- unified Operator Dashboard composition

## Staging Deployment Targets

### Frontend
Recommended:
- Vercel preview/staging project

Required env:

```bash
VITE_API_BASE_URL=https://staging-api.d3vonn.io
```

### Backend API
Recommended:
- Render, Railway, Fly.io, or AWS ECS/EKS staging

Required env:

```bash
OPERATOR_AUTH_REQUIRED=true
OPERATOR_API_TOKEN=<strong-random-token>
OPERATOR_ALLOWED_ROLES=admin,operator
GITHUB_REPOSITORY=wesship/supreme-ai-deployment-hub
GH_TOKEN=<read-only-github-token>
PROMETHEUS_URL=<prometheus-url>
LOKI_URL=<loki-url>
TEMPO_URL=<tempo-url>
JAEGER_QUERY_URL=<optional-jaeger-url>
REDIS_URL=<redis-url>
```

Optional env:

```bash
LOKI_OPERATOR_QUERY={app=~"devonn.*|backend|api"}
JAEGER_SERVICE=devonn-api
VERCEL_TOKEN=<vercel-token>
AWS_REGION=us-west-2
RENDER_API_KEY=<render-api-key>
RAILWAY_TOKEN=<railway-token>
```

## Deployment Order

### Step 1 — Backend Staging

Deploy FastAPI first.

Validate:

```bash
curl -i https://staging-api.d3vonn.io/health
```

Then validate protected Operator API:

```bash
curl -H "Authorization: Bearer $OPERATOR_API_TOKEN" \
  -H "X-Operator-Role: operator" \
  https://staging-api.d3vonn.io/api/operator/status
```

Expected:
- HTTP 200
- JSON status payload

### Step 2 — Observability Adapters

Validate metrics:

```bash
curl -H "Authorization: Bearer $OPERATOR_API_TOKEN" \
  https://staging-api.d3vonn.io/api/operator/metrics
```

Validate logs:

```bash
curl -H "Authorization: Bearer $OPERATOR_API_TOKEN" \
  https://staging-api.d3vonn.io/api/operator/logs
```

Validate traces:

```bash
curl -H "Authorization: Bearer $OPERATOR_API_TOKEN" \
  https://staging-api.d3vonn.io/api/operator/traces
```

Validate queues:

```bash
curl -H "Authorization: Bearer $OPERATOR_API_TOKEN" \
  https://staging-api.d3vonn.io/api/operator/queues
```

### Step 3 — Frontend Staging

Deploy frontend after backend is reachable.

Set:

```bash
VITE_API_BASE_URL=https://staging-api.d3vonn.io
```

Validate:
- Operator gate renders
- token entry works
- dashboard hydrates
- logs/traces/metrics/queues render
- logout clears session

### Step 4 — Runtime Stream

Validate WebSocket endpoint:

```bash
wscat -c wss://staging-api.d3vonn.io/api/operator/runtime/stream
```

Expected:
- operator.connected event
- operator.heartbeat events

## Staging Acceptance Criteria

Staging is acceptable when:

- frontend deploy succeeds
- backend health endpoint succeeds
- protected Operator API rejects unauthenticated requests
- protected Operator API accepts valid bearer token
- metrics endpoint returns Prometheus adapter result or safe fallback
- logs endpoint returns Loki adapter result or safe fallback
- traces endpoint returns OTel adapter result or safe fallback
- queues endpoint returns Redis adapter result or safe fallback
- GitHub Actions endpoint returns workflow telemetry or safe fallback
- runtime WebSocket emits heartbeat events
- dashboard renders without runtime errors
- logout clears operator session

## Rollback Plan

If staging fails:

1. Disable public access to staging frontend.
2. Set `OPERATOR_AUTH_REQUIRED=false` only in isolated internal testing, never public staging.
3. Revert latest staging deployment.
4. Keep backend in read-only mode.
5. Review `/api/operator/logs`, `/metrics`, `/traces`, and `/ci` outputs.

## Production Promotion Criteria

Do not promote to production until:

- staging runs clean for 24-48 hours
- auth is enforced
- no secrets leak in frontend bundles
- observability adapters return stable payloads
- all public endpoints use HTTPS
- CORS is restricted to approved frontend domains
- dashboard is protected
- rollback path is verified
