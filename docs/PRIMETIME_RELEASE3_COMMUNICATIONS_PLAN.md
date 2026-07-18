# PRIMETIME Release 3 — Governed Communications Plan

## Objective

Release 3 creates the compliance-first communication control plane for PRIMETIME. It does not send messages autonomously by default. It creates the governed records, approvals, checks, and event history required before email, SMS, voice, mail, or in-person communication workflows can be safely automated later.

## Scope

Release 3 introduces:

- Approved message templates
- Template version history
- Communication preferences
- Daily frequency counters
- Communication records
- Communication lifecycle events
- Communication policy checks
- Consent and suppression enforcement
- Quiet-hours and frequency-cap evidence
- Provider callback boundary records

## Non-negotiable controls

1. No outbound communication may be scheduled, sent, or marked delivered without an approved and currently effective template.
2. No SMS, email, or voice communication may proceed without consent or a not-required attestation.
3. Suppression records block outbound communication.
4. Calendar, delivery, SMS, email, and voice providers are not authoritative sources of client communication state.
5. Every communication state change must create an event record.
6. Release 3 does not introduce autonomous message sending.
7. AI may draft communication text, but production delivery requires human-approved templates and policy checks.

## Release 3 tables

- `message_templates`
- `message_template_versions`
- `communication_preferences`
- `communication_frequency_counters`
- `communications`
- `communication_events`
- `communication_policy_checks`

## Communication lifecycle

```text
DRAFT
→ PENDING_REVIEW
→ APPROVED
→ SCHEDULED
→ SENT
→ DELIVERED
→ RESPONDED
```

Blocked paths:

```text
DRAFT/PENDING_REVIEW → BLOCKED
SCHEDULED → CANCELLED
SENT/SCHEDULED → FAILED
ANY → OPTED_OUT
```

## Human approval policy

AI and automation may:

- Draft internal message content
- Suggest template improvements
- Prepare review packets
- Run policy checks
- Create tasks for reps or compliance reviewers

AI and automation may not:

- Send sales communication autonomously
- Bypass consent checks
- Bypass suppression records
- Use unapproved templates
- Make regulated insurance recommendations
- Impersonate a licensed representative

## Release 3 exit gate

Release 3 is complete when:

- Approved templates can be created and versioned.
- Communication records can be drafted and reviewed.
- Consent/suppression checks are enforced before approved/scheduled/sent states.
- Policy-check records are captured.
- Communication events are generated for lifecycle changes.
- The UI exposes no direct send action by default.
- Tests verify no delete endpoint or autonomous-send path exists.
