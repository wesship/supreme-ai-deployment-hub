# PRIMETIME Release 1 API Contract

This contract defines the minimum API surface for the Governed CRM Foundation.

## Base route

```text
/api/primetime/v1
```

## Required headers

```text
Authorization: Bearer <token>
X-Workspace-Id: <workspace_uuid>
X-Idempotency-Key: <unique_request_key> for mutating requests
```

## Workspaces

```text
GET /workspaces
POST /workspaces
GET /workspaces/{workspace_id}
```

## Members and roles

```text
GET /workspaces/{workspace_id}/members
POST /workspaces/{workspace_id}/members
PATCH /workspaces/{workspace_id}/members/{membership_id}
GET /workspaces/{workspace_id}/roles
POST /workspaces/{workspace_id}/roles
```

## People

```text
GET /people
POST /people
GET /people/{person_id}
PATCH /people/{person_id}
POST /people/dedupe/check
POST /people/{person_id}/archive
```

## Households

```text
GET /households
POST /households
GET /households/{household_id}
PATCH /households/{household_id}
POST /households/{household_id}/members
DELETE /households/{household_id}/members/{person_id}
```

## Leads and pipeline

```text
GET /leads
POST /leads
GET /leads/{lead_id}
PATCH /leads/{lead_id}
POST /leads/{lead_id}/stage
GET /leads/{lead_id}/transitions
GET /pipeline-stages
POST /pipeline-stages/seed
```

## Tasks

```text
GET /tasks
POST /tasks
GET /tasks/{task_id}
PATCH /tasks/{task_id}
POST /tasks/{task_id}/complete
```

## Activities

```text
GET /activities
POST /activities
GET /leads/{lead_id}/activities
GET /people/{person_id}/activities
```

Activities are append-only from the business perspective. Corrections should be separate activity records.

## Consent and suppression

```text
GET /people/{person_id}/consent
POST /people/{person_id}/consent
GET /people/{person_id}/suppressions
POST /people/{person_id}/suppressions
POST /people/{person_id}/communication-check
```

## Release gate exceptions

```text
GET /release-gate-exceptions
POST /release-gate-exceptions/scan
PATCH /release-gate-exceptions/{exception_id}
```

## Audit

```text
GET /audit-events
POST /audit-events
```

Audit events are immutable. Application code may append audit events but must not update or delete them.

## Required write behavior

Every mutating endpoint must:

1. Validate workspace membership.
2. Validate entity ownership or policy permission.
3. Validate input fields.
4. Apply domain policy checks.
5. Write the primary record.
6. Append an audit event.
7. Return the audit reference.

## Required response envelope

```json
{
  "data": {},
  "auditEventId": "audit_reference_or_null",
  "policy": {
    "allowed": true,
    "checks": []
  },
  "errors": []
}
```

## Release 1 blocked actions

- Communication sending
- Product recommendations
- Application submission
- Policy servicing updates
- Autonomous voice outreach
- Sensitive export without human authorization

These require later releases and additional controls.
