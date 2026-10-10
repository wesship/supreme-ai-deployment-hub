# PRIMETIME Release 1 API Contract

Status: implementation contract for Governed CRM Foundation.

Base path:

```text
/api/primetime/v1
```

## Required router groups

| Route group | Purpose |
|---|---|
| `/workspaces` | Workspace selection and settings |
| `/memberships` | Workspace user roles and hierarchy |
| `/people` | Individual contact records |
| `/households` | Household grouping and membership |
| `/pipeline-stages` | Controlled stage configuration |
| `/leads` | Governed lead records |
| `/tasks` | Assigned work and follow-up obligations |
| `/activities` | Calls, emails, meetings, notes, and status changes |
| `/consent` | Channel-specific permission records |
| `/suppressions` | Opt-out and do-not-contact controls |
| `/exceptions` | Release-gate exception queue |
| `/audit` | Read-only audit-event access for authorized roles |
| `/dashboard/daily` | Representative daily operating view |

## Policy dependency

Every endpoint must resolve:

- authenticated user
- active workspace
- workspace role
- manager hierarchy where applicable
- requested entity access scope

## Release 1 write rules

- Open leads cannot be created without owner, stage, source, consent state, next action, and next-action deadline.
- Stage changes must create transition history.
- Activity writes must update lead `last_activity_at`.
- Consent and suppression writes must create audit events.
- Audit events are append-only.
- Sensitive exports require explicit authorization and audit logging.

## Representative daily dashboard

`GET /dashboard/daily` must return:

- leads requiring action today
- overdue tasks
- appointments placeholder count for Release 2
- leads missing required controls
- new responses placeholder count for Release 3
- compliance alerts
- study progress placeholder for Release 5

## Release 1 exit gate endpoint

`GET /exceptions/release1` must show every open lead missing one or more required controls:

- owner
- stage
- source
- consent state
- next action
- next-action deadline
- last activity

## Definition of done for each endpoint

- Pydantic request and response models
- workspace policy dependency
- input validation
- audit write for sensitive actions
- unit test
- permission test
- error handling
- OpenAPI visibility
