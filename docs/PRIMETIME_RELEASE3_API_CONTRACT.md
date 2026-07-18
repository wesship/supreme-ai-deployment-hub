# PRIMETIME Release 3 API Contract — Governed Communications

Base path remains:

```text
/primetime/v1
```

Release 3 extends the governed PRIMETIME API without creating a separate version namespace. All endpoints require active workspace membership and must use the fixed Supabase table allow-list.

## Template endpoints

```http
GET  /primetime/v1/message-templates
POST /primetime/v1/message-templates
PATCH /primetime/v1/message-templates/{template_id}

GET  /primetime/v1/message-template-versions
POST /primetime/v1/message-template-versions
```

Template controls:

- Approved templates require reviewer, approval timestamp, and effective timestamp.
- Expired or retired templates cannot be used for approved/scheduled/sent communication states.
- Template versions are append-style review artifacts.

## Preference and policy endpoints

```http
GET  /primetime/v1/communication-preferences
POST /primetime/v1/communication-preferences
GET  /primetime/v1/communication-policy-checks
POST /primetime/v1/communication-policy-checks
```

Policy checks must record:

- Consent result
- Suppression result
- Quiet-hours result
- Frequency-cap result
- Template-approval result
- Disclosure result
- Jurisdiction result
- Licensed-review result when applicable

## Communication endpoints

```http
GET  /primetime/v1/communications
POST /primetime/v1/communications
PATCH /primetime/v1/communications/{communication_id}
GET  /primetime/v1/communication-events
POST /primetime/v1/communication-events
```

Communication controls:

- No DELETE endpoint.
- No `/send` endpoint in Release 3.
- Drafting and scheduling records are allowed.
- Actual delivery remains out of scope until delivery-provider governance is added.
- Status updates must create communication events.

## Blocked by default

Release 3 must not include:

- Autonomous outbound delivery
- Bulk blast delivery
- Unapproved template use
- Suppression bypass
- Consent bypass
- AI product recommendation delivery
- AI impersonation of a licensed representative

## Review roles

Recommended role gates:

| Action | Roles |
|---|---|
| Create draft communication | representative, manager, workspace_admin |
| Approve communication/template | compliance_reviewer, manager, workspace_admin |
| Create suppression/policy block | compliance_reviewer, manager, workspace_admin |
| Read communication history | representative, trainer, manager, compliance_reviewer, workspace_admin, auditor |

## Audit actions

Runtime API implementation should write `audit_events` for:

- `message_template.created`
- `message_template.updated`
- `message_template_version.created`
- `communication_preference.updated`
- `communication.created`
- `communication.updated`
- `communication_event.created`
- `communication_policy_check.created`
