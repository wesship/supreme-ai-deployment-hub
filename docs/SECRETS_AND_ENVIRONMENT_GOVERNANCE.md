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

## Frontend Exposure Rule

Only variables intentionally prefixed with `VITE_` may be exposed to the browser.

Never expose:

- provider API keys intended for server use
- database service-role keys
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
