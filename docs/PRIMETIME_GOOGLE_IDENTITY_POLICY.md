# PRIMETIME Google Identity & Connector Policy

## Production rule

Personal Google identities MUST NOT be used as the permanent production identity for PRIMETIME / DEVONN automated Gmail, Calendar, Drive, or related Google workflows.

## Required identity separation

1. **Personal identity** — private email, personal calendar, personal Drive and unrelated Google data. Not an automation service identity.
2. **DEVONN business identity** — organization-controlled mailbox/calendar used for business operations and explicitly authorized workflows.
3. **Integration/service identity** — narrowly scoped OAuth/service credentials where the Google API and architecture support them. Backend secrets remain server-side.

## Environment gates

- `development`: personal account may be used only for low-risk, reversible connectivity tests with explicit authorization.
- `staging`: prefer dedicated DEVONN test/business identity. Personal-account connector writes are disabled after initial connectivity validation.
- `production`: dedicated DEVONN-controlled identity is mandatory. Personal Google accounts are prohibited for automated writes.

## Least privilege

Grant only the scopes needed by the workflow. Gmail, Calendar, and Drive permissions are reviewed independently. Do not grant broad Google account access simply because one connector requires a narrower capability.

## Write controls

- Email sending requires approved workflow, consent/communication-policy checks where applicable, idempotency, audit evidence, and a kill switch.
- Calendar creation/update requires an approved workflow, intended calendar identity, idempotency, audit evidence, and a kill switch.
- No automated workflow may silently use the owner's personal mailbox/calendar as a fallback production identity.

## Secret handling

OAuth refresh tokens, client secrets, service credentials, and signing secrets MUST be stored in the deployment secret manager/server environment. They MUST NOT be committed to GitHub, embedded in browser bundles, logged in plaintext, or stored in CRM free-text fields.

## Account security

Dedicated business identities should use MFA/passkeys, organization-controlled recovery methods, least-privilege administrators, periodic access review, and immediate revocation procedures.

## Staging canary rule

Provider canaries must be reversible and non-customer-impacting. Gmail canaries should use draft/create-delete behavior where possible. Calendar canaries should have no attendees, no notifications, no Meet link, private visibility, and immediate cleanup.

## Production enablement checklist

Production Google connector writes remain disabled until all are true:

- dedicated DEVONN business Google identity exists;
- OAuth app/client is organization controlled;
- approved redirect URIs are configured;
- required scopes are documented and minimized;
- secrets are in the deployment secret store;
- webhook/token refresh handling is tested;
- connector idempotency/reconciliation is tested;
- audit logging is enabled;
- kill switch is tested;
- owner/admin production approval is recorded.
