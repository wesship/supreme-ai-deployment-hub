# D3VONN.IO Production Hardening Checklist

## Edge Function auth

Prefer Supabase platform JWT verification for `ai-router`. Keep manual JWKS verification only when custom JWT checks are required.

## Health endpoints

Use these semantics:

- `/health` for basic process health.
- `/health/live` for liveness checks.
- `/ready` for the existing readiness route.
- `/health/ready` for dependency readiness.
- `/health/deep` for detailed service status.

## Secret naming

Use consistent names across VPS, Supabase Edge Functions, GitHub Actions, and local development:

- Supabase URL, service role, frontend URL, and frontend anon key.
- OpenAI, Anthropic, and Google provider keys.
- Pinecone API key, host, index, and embedding model.
- Twilio SID, auth token, and sender number.
- JWT, Redis, and Grafana server secrets.

## Observability

Hermes and `ai-router` logs should include request ID, user ID when available, provider, task, duration, token usage when available, and sanitized error details.

Never log provider keys, JWTs, service-role credentials, or full authorization headers.

## Launch verification

Before launch, verify TLS, certificate renewal, firewall rules, container restart policies, backups, Redis, Supabase auth, Pinecone retrieval, AI provider routing, Twilio SMS, structured logs, and monitoring dashboards.
