# Minimal Live Staging Stack

## Purpose

This blueprint defines the smallest live staging stack required to prove Devonn.ai runtime resilience before production promotion.

## Staging Objective

Run the platform in a real hosted environment with queue, database, telemetry, and rollback visibility.

## Recommended Stack

| Layer | Target |
|---|---|
| Frontend | Vercel preview/staging deployment |
| API | Railway or Render web service |
| Database | Neon Postgres staging branch |
| Queue | Upstash Redis staging database |
| Metrics | Prometheus-compatible endpoint |
| Dashboards | Grafana Cloud or self-hosted Grafana |
| Tracing | OpenTelemetry collector or Grafana Tempo-compatible path |

## Required Staging Environment Variables

### Frontend

- VITE_ENVIRONMENT=staging
- VITE_API_URL
- VITE_SUPABASE_URL if Supabase is active
- VITE_SUPABASE_PUBLISHABLE_KEY if Supabase is active
- VITE_APP_VERSION

### API / Runtime

- NODE_ENV=staging
- DEPLOYMENT_VERSION
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- ENCRYPTION_KEY
- OPENAI_API_KEY if LLM calls are enabled
- OTEL_EXPORTER_OTLP_ENDPOINT if tracing is enabled

### CI / Deployment

- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID
- RAILWAY_TOKEN or RENDER_API_KEY when applicable
- SLACK_WEBHOOK_DEPLOYS optional

## Minimum Health Endpoints

Staging services should expose:

- /health
- /ready
- /metrics
- /version

## Minimum Runtime Validation

Before production promotion, staging must pass:

- build validation
- deployment validation
- worker crash drill
- retry ceiling drill
- DLQ routing drill
- replay rejection drill
- rollback visibility drill
- metrics scrape validation

## Promotion Rule

Do not promote to production until staging proves recovery behavior under real hosted conditions.
