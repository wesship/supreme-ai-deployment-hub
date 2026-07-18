# PRIMETIME Environment Matrix

## Purpose

This matrix defines the minimum environments, variables, ownership, and validation checks required before PRIMETIME can move from staging to production.

## Environments

| Environment | Purpose | Required Before Production |
| --- | --- | --- |
| Local | Developer validation | Yes |
| Preview | PR-level smoke validation | Yes |
| Staging | Full stack migration and QA validation | Yes |
| Production | Live business use | Final gate only |

## Core Services

| Service | Local | Preview | Staging | Production |
| --- | --- | --- | --- | --- |
| Frontend | Vite local | Vercel preview | Vercel staging/project alias | Vercel production |
| Backend | FastAPI local | Preview API or mock | Staging API | Production API |
| Database | Local/Supabase dev | Seeded mock or staging | Supabase staging | Supabase production |
| Auth | Supabase dev | Supabase preview/staging | Supabase staging | Supabase production |
| Observability | Console/local logs | Preview logs | Sentry/log drain | Sentry/log drain |
| Security Scan | Local/dependency check | Snyk PR check | Snyk/release scan | Snyk/release scan |

## Required Environment Variables

### Frontend

| Variable | Purpose | Secret? | Production Rule |
| --- | --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | No | Must point to production API |
| `VITE_SUPABASE_URL` | Supabase project URL | No | Must point to production Supabase |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon key | No | Public anon only; never service role |

### Backend

| Variable | Purpose | Secret? | Production Rule |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | No | Must point to production Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access | Yes | Backend only; never frontend |
| `SUPABASE_ANON_KEY` | Optional fallback/public access | No | Do not use for privileged writes |
| `SENTRY_DSN` | Error tracking | Yes-ish | Required for production if Sentry used |
| `ENVIRONMENT` | Runtime environment label | No | Must be `production` in production |
| `ALLOWED_ORIGINS` | CORS origin allow-list | No | Must list production domains only |
| `ALLOWED_ORIGIN_REGEX` | Optional CORS regex | No | Avoid broad wildcard in production |

## Secret Handling Rules

1. No service-role key in frontend code.
2. No production secret committed to repository.
3. No screenshots or logs containing service-role secrets.
4. Secret rotation owner must be assigned.
5. Production backend deploy must verify secret scope before release.

## Staging Validation Matrix

| Validation | Owner | Required Result |
| --- | --- | --- |
| Backend `/healthz` | Backend Owner | 200 OK |
| Frontend load | Frontend Owner | Routes render |
| Supabase connection | Database Owner | Read/write to staging tables works |
| Migration order | Database Owner | All migrations apply cleanly |
| RLS enabled | Database Owner | All regulated tables protected |
| Consent blocking | Compliance Reviewer | Outbound communications require consent/suppression checks |
| AI action ledger | Compliance Reviewer | AI actions are audited |
| Analytics boundary | QA Owner | Analytics does not mutate business records |
| Blocked endpoints | QA Owner | `/send`, `/quote`, `/recommend-policy`, `/submit-application` unavailable |
| No hard DELETE | QA Owner | No regulated delete endpoint exposed |

## Production Smoke Tests

Run immediately after production deploy:

1. Load frontend home.
2. Load `/primetime`.
3. Load `/primetime/scheduling`.
4. Load `/primetime/communications`.
5. Load `/primetime/ai-assistance`.
6. Load `/primetime/executive-command-center`.
7. Call backend `/healthz`.
8. Confirm blocked endpoint fragments are not exposed.
9. Confirm no PRIMETIME DELETE endpoint is exposed.
10. Confirm audit writes for a safe non-regulated test action in a controlled workspace.

## Environment Approval

| Environment | Owner | Status | Notes |
| --- | --- | --- | --- |
| Local | Developer | Pending | TBD |
| Preview | Release Manager | Pending | TBD |
| Staging | QA Owner | Pending | TBD |
| Production | Business Owner | Pending | TBD |
