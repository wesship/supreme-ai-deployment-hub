# Secrets and Environment Governance Contract

## Purpose

This document defines the required secrets, environment separation rules, and deployment integrity expectations for Devonn.ai.

The goal is to prevent secret drift, production/staging mismatch, accidental client-side exposure, and unsafe deployment promotion.

## Core Rules

- Never commit real secrets.
- Never expose server-only secrets through Vite or browser-visible variables.
- Keep staging and production environments separate.
- Validate required secret presence before deployment.
- Rotate exposed or suspicious tokens immediately.
- Prefer OIDC and short-lived credentials over long-lived static keys.

## Secret Classes

### GitHub / CI

Required or recommended:

- GH_PAT when cross-repo access is required
- GITHUB_TOKEN for repository-local workflow operations
- CODECOV_TOKEN if coverage upload is enforced

### Cloud

Required depending on deployment target:

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- AWS_ROLE_ARN when OIDC is enabled
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID

### Application

Required depending on active runtime:

- OPENAI_API_KEY
- SUPABASE_ACCESS_TOKEN
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- JWT_SECRET
- ENCRYPTION_KEY

### Observability

Recommended:

- SENTRY_AUTH_TOKEN
- VITE_SENTRY_DSN
- SLACK_WEBHOOK_URL
- SLACK_WEBHOOK_DEPLOYS

## Supabase Key Map

Use the following names consistently. Never copy a key into a variable with a different security class.

| Supabase dashboard item | Typical format | D3VONN.IO variable | Exposure | Notes |
|---|---|---|---|---|
| Publishable key | `sb_publishable_...` | `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Preferred frontend key. |
| Legacy anon key | JWT beginning `eyJ...` | `VITE_SUPABASE_ANON_KEY` or server compatibility alias `SUPABASE_ANON_KEY` | Browser-safe with RLS | Current frontend accepts this only as a fallback to the publishable key. |
| Legacy service-role key | JWT beginning `eyJ...` with service-role claims | `SUPABASE_SERVICE_ROLE_KEY` | Server-only critical secret | Current backend code expects this exact variable name. It bypasses RLS. |
| Modern secret key | `sb_secret_...` | No canonical runtime alias yet | Server-only critical secret | Do not substitute it for `SUPABASE_SERVICE_ROLE_KEY` until every backend consumer is migrated and tested. |
| JWT key ID | Short identifier shown with a JWT signing key | Not an API-key environment variable | Non-secret identifier | Used to identify a signing key in JWT/JWKS verification. It is not `JWT_SECRET`, not an anon key, and not a service-role key. |
| Project ID / project ref | Project reference string | `SUPABASE_PROJECT_ID`, `SUPABASE_PROJECT_REF` | Non-sensitive configuration | Store as GitHub environment variables when possible. |

The Supabase project URL belongs in `VITE_SUPABASE_URL` for browser builds and `SUPABASE_URL` for server runtimes. Staging and production must use different project refs, URLs, and credentials.

## Frontend Exposure Rule

Only variables intentionally prefixed with `VITE_` may be exposed to the browser.

Never expose:

- provider API keys intended for server use
- database service-role or modern secret keys
- JWT signing secrets
- encryption keys
- GitHub tokens
- cloud credentials

## Environment Separation

Each environment must define its own values:

- development
- staging
- production

Staging must not reuse production secrets unless explicitly approved.

## Promotion Safety

Before promotion, verify:

- required secrets exist
- frontend-only variables are safe
- server-only secrets are not referenced by client code
- environment values match the target environment
- rotation status is known

## Rotation Policy

Rotate immediately when:

- a token is pasted into chat
- a token appears in logs
- a token appears in Git history
- CI reports leakage
- a provider reports suspicious activity

## Production Readiness Rule

Devonn.ai should not be promoted to production unless required secrets are present, scoped correctly, environment-separated, and not exposed to the frontend bundle.
