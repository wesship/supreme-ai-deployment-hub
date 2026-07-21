import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const APP = readFileSync('src/App.tsx', 'utf8');
const PAGE = readFileSync('src/pages/PrimetimeScheduling.tsx', 'utf8');
const API = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PRIMETIME Release 2 scheduling UI wiring', () => {
  it('registers the Release 2 routes', () => {
    expect(APP).toContain('PrimetimeScheduling');
    expect(APP).toContain('path="/primetime/scheduling"');
    expect(APP).toContain('path="/primetime/release-2"');
  });

  it('uses governed scheduling API endpoints', () => {
    expect(API).toContain('/primetime/v1/appointments');
    expect(API).toContain('/primetime/v1/availability-rules');
    expect(API).toContain('/primetime/v1/appointment-attendees');
    expect(API).toContain('/primetime/v1/reminders');
    expect(API).toContain('/primetime/v1/no-show-events');
    expect(API).toContain('/primetime/v1/calendar-sync-events');
    expect(API).toContain('method: \'POST\'');
    expect(API).toContain('method: \'PATCH\'');
  });

  it('exposes the Release 2 scheduling surfaces', () => {
    expect(PAGE).toContain('Scheduling and Daily Operations');
    expect(PAGE).toContain('Create appointment');
    expect(PAGE).toContain('Availability rule');
    expect(PAGE).toContain('Appointment board');
    expect(PAGE).toContain('Reminder queue');
    expect(PAGE).toContain('No-show recovery');
    expect(PAGE).toContain('calendar-sync');
  });

  it('uses the exact scheduling API payload contracts', () => {
    expect(PAGE).toContain('start_at: appointment.start_at');
    expect(PAGE).toContain('end_at: appointment.end_at');
    expect(PAGE).toContain('appointment_type: appointment.appointment_type');
    expect(PAGE).toContain("compliance_state: 'pending'");
    expect(PAGE).toContain('user_id: userId');
    expect(PAGE).toContain('rule_name: availability.rule_name');
    expect(PAGE).toContain('start_time: availability.start_time');
    expect(PAGE).toContain('end_time: availability.end_time');
    expect(PAGE).toContain('recipient_user_id: userId');
    expect(PAGE).toContain('attendee_role');
    expect(PAGE).not.toContain('starts_at: appointment');
    expect(PAGE).not.toContain('ends_at: appointment');
    expect(PAGE).not.toContain('meeting_type: appointment');
    expect(PAGE).not.toContain('owner_id: userId, day_of_week');
  });

  it('does not expose hard-delete behavior', () => {
    expect(API).not.toContain("method: 'DELETE'");
    expect(PAGE).not.toContain('deleteAppointment');
    expect(PAGE).not.toContain('Delete appointment');
  });
});
