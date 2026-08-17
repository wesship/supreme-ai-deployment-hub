# PRIMETIME Release 2 — Scheduling Plan

## Overview

Release 2 introduces appointment scheduling, availability rules, reminders, and no-show recovery.

## Release 2 exit gate

- Appointments can be booked, confirmed, rescheduled, and completed
- no-show appointment creates a recovery task
- calendar sync writes integration events (non-authoritative)
- All scheduling controls enforced via trigger

## Governance

- Calendar sync is boundary-only, never authoritative
- No DELETE of appointment records
