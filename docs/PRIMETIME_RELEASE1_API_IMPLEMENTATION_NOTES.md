# PRIMETIME Release 1 API Implementation Notes

## Branch strategy

This branch builds on the clean Release 1 schema branch instead of the old closed PR #236 branch.

- Base dependency: `feat/primetime-release1-clean`
- API branch: `feat/primetime-release1-api`

The API should be reviewed after the schema PR lands or as a stacked PR targeting the schema branch.

## API scope

The router is implemented in:

```text
backend/app/routers/primetime_release1.py
```

Prefix:

```text
/primetime/v1
```

## Included endpoints

```text
GET  /primetime/v1/workspaces
POST /primetime/v1/workspaces
GET  /primetime/v1/people
POST /primetime/v1/people
GET  /primetime/v1/households
POST /primetime/v1/households
GET  /primetime/v1/pipeline-stages
GET  /primetime/v1/leads
POST /primetime/v1/leads
PATCH /primetime/v1/leads/{lead_id}
POST /primetime/v1/tasks
POST /primetime/v1/activities
POST /primetime/v1/consent-records
POST /primetime/v1/suppression-records
GET  /primetime/v1/exceptions
GET  /primetime/v1/dashboard/daily
```

## Security controls

- Supabase URL is validated against `https://*.supabase.co` or `https://*.supabase.in`.
- Supabase table names are fixed through an allow-list.
- UUID path and identity values are validated before query use.
- Workspace membership is checked before workspace-scoped data access.
- No delete endpoint is exposed in Release 1.
- Sensitive state changes should continue to be captured by database audit triggers and future explicit audit writers.

## Intentional limitations

This first API layer is CRUD-oriented and governance-aware, but it is not the final policy engine.

Still needed:

1. Mount router in the active FastAPI app once the deployment entrypoint is confirmed.
2. Add typed response models.
3. Add API-level audit writer for command/action context.
4. Add role-specific permission checks beyond active workspace membership.
5. Add pagination cursors and search filters.
6. Add duplicate detection endpoint for people and households.
7. Add dashboard aggregation SQL views for performance.
8. Add integration tests against a disposable Supabase/Postgres instance.

## Release gate alignment

This API supports Release 1 foundations:

- Workspaces and role-based access
- People and households
- Leads and governed pipeline stages
- Tasks and activities
- Consent and suppression records
- Exception queue
- Daily representative dashboard foundation
