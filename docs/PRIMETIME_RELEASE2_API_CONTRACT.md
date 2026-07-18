# PRIMETIME Release 2 Scheduling API Contract

Base path:

```text
/primetime/v1
```

Release 2 extends the existing governed API instead of creating a separate public surface.

## Endpoints

```text
GET  /primetime/v1/appointments
POST /primetime/v1/appointments
PATCH /primetime/v1/appointments/{appointment_id}

GET  /primetime/v1/availability-rules
POST /primetime/v1/availability-rules

POST /primetime/v1/appointment-attendees
POST /primetime/v1/reminders
GET  /primetime/v1/reminders
GET  /primetime/v1/no-show-events
POST /primetime/v1/calendar-sync-events
```

## Appointment create payload

```json
{
  "workspace_id": "uuid",
  "lead_id": "uuid optional",
  "household_id": "uuid optional",
  "owner_id": "uuid",
  "title": "Family Financial Readiness Review",
  "meeting_type": "consultation",
  "starts_at": "2026-07-19T15:00:00Z",
  "ends_at": "2026-07-19T15:30:00Z",
  "timezone": "America/Denver",
  "location_type": "virtual",
  "location_details": {},
  "compliance_status": "pending",
  "source": "manual"
}
```

## Required controls

Before creating or updating an appointment, the API must verify:

1. active workspace membership
2. role is allowed to create appointments
3. valid appointment time range
4. required owner
5. appointment is not compliance-blocked
6. optional lead belongs to workspace
7. optional household belongs to workspace
8. complete audit event is written

## Reminder boundary

Reminder records may be scheduled in Release 2, but actual SMS/email/voice delivery remains controlled by Release 3 communication governance.

Reminder creation must store:

- workspace
- appointment or task
- channel
- target person or user
- scheduled time
- policy check state

## Calendar sync boundary

Calendar sync events are non-authoritative. A provider event may never overwrite appointment state without API policy checks and audit logging.

## No delete policy

No Release 2 scheduling endpoints expose hard-delete behavior.

Cancellation is represented by appointment status:

```text
canceled
```

No-show is represented by appointment status:

```text
no_show
```

The no-show trigger creates a recovery task and no-show event.
