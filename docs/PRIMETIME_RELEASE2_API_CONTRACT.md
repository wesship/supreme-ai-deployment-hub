# PRIMETIME Release 2 — Scheduling API Contract

## Overview

Release 2 introduces appointment scheduling, availability rules, reminders, and no-show recovery.
Calendar sync is non-authoritative — it may never overwrite appointment state.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /primetime/v1/appointments | List appointments for workspace |
| POST | /primetime/v1/appointments | Create appointment |
| PATCH | /primetime/v1/appointments/{id} | Update appointment |
| GET | /primetime/v1/availability-rules | List availability rules |
| POST | /primetime/v1/availability-rules | Create availability rule |
| GET | /primetime/v1/reminders | List reminders |
| POST | /primetime/v1/reminders | Create reminder |

## Calendar Sync

Calendar sync writes integration events but is **non-authoritative**.
External calendar providers may never overwrite appointment state — they are boundary signals only.

## Release 2 exit gate

- no-show appointment creates a recovery task
- calendar sync writes integration events
- All appointments require an owner and valid time range
- Blocked appointments cannot be scheduled

## Governance Boundaries

- No DELETE endpoint for regulated appointment records
- No autonomous rescheduling without owner approval
