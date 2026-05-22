# Devonn.ai Staging Environment Contract

Do not commit local environment files or real credentials. Local-only values belong in `.env.staging.local`, which must remain untracked.

## Required staging defaults

```text
ENVIRONMENT=staging
AUTONOMY_MODE=guarded
EXECUTION_MODE=dry-run
```

These values are mandatory for staging because they prevent the system from behaving like production before the deployment shape is proven.

## Core runtime groups

### Runtime identity

Used by all services.

- environment name
- autonomy mode
- execution mode
- log level

### Database

Used by API and local compose database.

- local database name
- local database user
- local database password
- application database connection URL

Managed staging connection values must be stored only in the hosting provider's secret manager.

### Queue and cache

Used by API, orchestrator, and worker.

- Redis-compatible connection URL
- queue name
- queue namespace

### Vector memory

Used by API and retrieval components.

- vector database URL
- vector database access token, when required by the provider
- collection/index name

### Service URLs

Used by frontend, orchestrator, and worker.

- internal API base URL
- browser-visible API base URL
- orchestrator URL, if exposed

### Auth and frontend integration

Used only when auth is active.

- public frontend auth URL
- public frontend auth client key
- server-side service credential, API only

### AI providers

Used by API and worker only.

- provider credentials must be platform secrets
- never expose provider credentials to frontend code
- never commit provider credentials to git

## Local file rule

`.env.staging.local` is intentionally referenced by compose but must not be committed.

The staging CI workflow blocks this exact filename if it is tracked.

## Promotion rule

Before production promotion, confirm that staging values are not reused for production and production values are not present in local files.
