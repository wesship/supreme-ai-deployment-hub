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
GET  /primetime/v1/people/duplicates
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
- Role gates restrict write, compliance, and administrative actions.
- No delete endpoint is exposed in Release 1.
- API-level audit events are written for sensitive creates and lead updates.

## Role gates

Initial API roles are intentionally conservative.

| Action area | Roles allowed |
|---|---|
| CRM create/update | representative, manager, workspace_admin |
| Activity creation | representative, manager, workspace_admin, compliance_reviewer |
| Consent record creation | representative, manager, workspace_admin, compliance_reviewer |
| Suppression record creation | compliance_reviewer, manager, workspace_admin |
| Read workspace records | active workspace membership |

Future policy checks should add hierarchy, assigned-owner, shared-record, and auditor read-only controls.

## Audit writer

The router writes `audit_events` for:

- workspace.created
- person.created
- household.created
- lead.created
- lead.updated
- task.created
- activity.created
- consent.recorded
- suppression.created

Database-level immutability remains the final control. API audit writes provide action context and user attribution.

## Duplicate lookup

`GET /people/duplicates` supports early duplicate detection by email or phone before creating a person record.

This is only a first-pass lookup. Future work should add normalized phone/email fields, fuzzy name matching, household-aware matching, and merge-review workflows.

## Intentional limitations

This API layer is governance-aware but is not the final policy engine.

Still needed:

1. Mount router in the active FastAPI app once the deployment entrypoint is confirmed.
2. Add typed response models.
3. Add owner-specific and hierarchy-specific authorization checks.
4. Add cursor pagination and safer search sanitization.
5. Add household duplicate detection and merge review.
6. Add dashboard aggregation SQL views for performance.
7. Add integration tests against a disposable Supabase/Postgres instance.
8. Add OpenAPI examples for frontend implementation.

## Release gate alignment

This API supports Release 1 foundations:

- Workspaces and role-based access
- People and households
- Leads and governed pipeline stages
- Tasks and activities
- Consent and suppression records
- Exception queue
- Daily representative dashboard foundation
