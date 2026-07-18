# PRIMETIME Release 2 — Scheduling and Daily Operations

Release 2 extends the governed CRM foundation with appointment booking, calendar boundaries, reminders, no-show recovery, and daily operation handoffs.

## Scope

Build only the scheduling layer needed after Release 1:

- appointments
- appointment attendees
- availability rules
- reminders
- no-show events
- calendar sync event boundary
- scheduling audit events
- scheduling exception scanning

Out of scope for this release:

- autonomous sales calling
- communication campaigns
- AI sales recommendations
- carrier integrations
- international scheduling rules
- fully bidirectional Google Calendar sync implementation

## Data model

### appointments

Canonical meeting record. Every scheduled appointment requires:

- workspace
- owner
- title
- meeting type
- status
- start time
- end time
- timezone
- location type
- compliance status
- source

### appointment_attendees

Connects contacts and users to an appointment. Supports roles such as host, prospect, trainer, and licensed representative.

### availability_rules

Stores bookable windows per user and workspace.

### reminders

Stores scheduled reminders for appointments or tasks. Actual delivery remains governed by the Release 3 communication layer.

### no_show_events

Created when an appointment becomes `no_show`. The trigger creates a recovery task automatically.

### calendar_sync_events

Non-authoritative integration boundary for external calendars. The database remains the source of truth.

## Enforcement

Scheduling enforcement includes:

- active appointments require owner
- active appointments require valid time range
- blocked appointments cannot be scheduled
- no-show appointments create recovery tasks
- appointment status changes create activity records
- release exception scanner identifies broken scheduling records

## n8n boundary

n8n may deliver calendar sync, webhooks, and notifications, but cannot be authoritative for appointment state, reminder state, consent, audit records, or approval decisions.

## Release 2 exit gate

Release 2 is not complete until:

- appointments can be created, confirmed, rescheduled, completed, canceled, and marked no-show
- all appointment state changes are logged
- all appointment attendees are recorded
- no-show appointment creates a recovery task
- reminders can be scheduled but remain policy-gated before delivery
- calendar sync writes integration events, not authoritative appointment state
- representative daily dashboard includes today’s appointments and overdue scheduling actions
- static and integration tests cover core flow

## Recommended build order

1. Scheduling schema migration
2. Static schema tests
3. Scheduling API router
4. Scheduling audit writer integration
5. Daily dashboard appointment extension
6. Scheduling UI
7. E2E test using a seeded workspace
8. Calendar provider adapter boundary
