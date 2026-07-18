# PRIMETIME Production Readiness Checklist

## Purpose

This checklist defines the production readiness standard for the PRIMETIME insurance-agent operating system.

## Environment readiness

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_API_URL`
- `ALLOWED_ORIGINS`
- `SENTRY_DSN` when enabled
- Deployment provider project identifiers
- CI security scanner configuration

Environment rules:

- Secrets must not be committed.
- Supabase URL must use an allowed Supabase host.
- Service role keys must only run server-side.
- Frontend must never expose service role keys.
- Production and staging must use separate Supabase projects.

## Migration readiness

Migration order:

1. Release 1 CRM foundation
2. Release 1 enforcement
3. Release 2 scheduling
4. Release 3 communications
5. Release 4 AI assistance
6. Release 5 analytics command center

Required checks:

- Migrations apply cleanly in order.
- RLS is enabled for PRIMETIME tables.
- Required functions and triggers exist.
- Seeded canonical data is idempotent.
- Rollback strategy exists before production migration.

## Backend readiness

Required backend checks:

- `/healthz` returns OK.
- `/primetime/v1` routers are mounted.
- Supabase host validation is enforced.
- UUID validation is enforced.
- Fixed table allow-lists are enforced.
- Active workspace membership is required.
- RBAC gates are implemented.
- Audit writes exist for create/update actions.
- No regulated hard-delete endpoints exist.

Blocked backend endpoint classes:

- `/send`
- `/quote`
- `/recommend-policy`
- `/submit-application`
- autonomous outbound voice calls
- regulated AI execution without human approval

## Frontend readiness

Required frontend routes:

- `/primetime`
- `/primetime/release-1`
- `/primetime/scheduling`
- `/primetime/release-2`
- `/primetime/communications`
- `/primetime/release-3`
- `/primetime/ai-assistance`
- `/primetime/release-4`
- `/primetime/executive-command-center`
- `/primetime/release-5`

Required UI boundaries:

- No hard-delete controls for regulated records.
- No send button for governed communications in Release 3.
- No quote or policy recommendation UI.
- No autonomous AI execution UI.
- Compliance notices are visible.
- Draft-first workflows are visible.

## Test readiness

Required tests:

- Release 1 schema static tests
- Release 1 API static tests
- Release 1 UI static tests
- Release 1 seeded E2E
- Release 2 schema/API/UI/static/E2E tests
- Release 3 schema/API/UI/static/E2E tests
- Release 4 schema/API/UI/static/E2E tests
- Release 5 schema/API/UI/static/E2E tests
- Release 6 production hardening static tests

## Observability readiness

Required signals:

- API health status
- Request logs
- Error logs
- Audit events
- Communication policy checks
- AI action ledger records
- Release governance observations
- Analytics snapshots
- CI status checks
- Deployment previews

## Compliance readiness

Required compliance checks:

- Consent before outbound communication.
- Suppression records block outreach.
- Approved template required before scheduled/sent communication state.
- AI outputs are draft-first.
- Regulated recommendations are blocked.
- Licensed review paths exist.
- Compliance findings are recordable.
- Audit trail is immutable or append-only where required.

## Known external blocker

The PR stack has a repeated duplicate Snyk check:

- Passing: `security/snyk (wesship)`
- Erroring duplicate: `security/snyk (wesship8)`

This appears to be an external integration or branch-protection configuration issue, not a PRIMETIME code path issue, because the primary Snyk check and Vercel checks pass across the stack.

## Go-live decision

Production deployment should not proceed until:

- Required branch-protection checks are confirmed.
- Duplicate external scanner behavior is resolved or explicitly accepted by the repo owner.
- Migration dry run passes.
- Rollback plan is approved.
- Compliance reviewer signs off.
- Workspace admin signs off.
