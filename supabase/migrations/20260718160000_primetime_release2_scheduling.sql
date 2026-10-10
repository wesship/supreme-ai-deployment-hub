-- PRIMETIME Release 2: Scheduling and Daily Operations
-- Canonical tables: appointments, availability_rules, reminders, no_show_events
-- Exit gates: appointments_booked_confirmed_rescheduled_completed,
--             appointment_events_visible_in_crm,
--             missed_appointments_create_followup_tasks

begin;

-- ────────────────────────────────────────────────────────────
-- Availability rules (per-workspace, per-member schedule)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_availability_rules (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.primetime_workspaces(id) on delete restrict,
  member_id      uuid not null references public.primetime_workspace_memberships(id) on delete restrict,
  day_of_week    smallint not null check (day_of_week between 0 and 6),
  start_time     time not null,
  end_time       time not null,
  timezone       text not null default 'America/New_York',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint primetime_availability_time_order check (end_time > start_time)
);

-- ────────────────────────────────────────────────────────────
-- Appointments
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_appointments (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  lead_id             uuid references public.primetime_leads(id) on delete restrict,
  owner_member_id     uuid not null references public.primetime_workspace_memberships(id) on delete restrict,
  title               text not null,
  description         text,
  status              text not null default 'scheduled'
                        check (status in ('scheduled','confirmed','rescheduled','completed','cancelled','no_show')),
  scheduled_at        timestamptz not null,
  duration_minutes    integer not null default 60 check (duration_minutes > 0),
  location            text,
  meeting_url         text,
  calendar_event_id   text,
  calendar_provider   text,
  reminder_sent_at    timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_by          uuid references public.primetime_workspace_memberships(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Appointment attendees
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_appointment_attendees (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id  uuid not null references public.primetime_appointments(id) on delete cascade,
  person_id       uuid references public.primetime_people(id) on delete restrict,
  member_id       uuid references public.primetime_workspace_memberships(id) on delete restrict,
  role            text not null default 'attendee' check (role in ('host','attendee','observer')),
  rsvp_status     text not null default 'pending' check (rsvp_status in ('pending','accepted','declined')),
  created_at      timestamptz not null default now(),
  constraint primetime_attendee_has_subject check (person_id is not null or member_id is not null)
);

-- ────────────────────────────────────────────────────────────
-- Reminders
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_reminders (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id  uuid references public.primetime_appointments(id) on delete cascade,
  task_id         uuid references public.primetime_tasks(id) on delete cascade,
  member_id       uuid not null references public.primetime_workspace_memberships(id) on delete restrict,
  channel         text not null check (channel in ('email','sms','in_app','push')),
  remind_at       timestamptz not null,
  sent_at         timestamptz,
  status          text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  created_at      timestamptz not null default now(),
  constraint primetime_reminder_has_subject check (appointment_id is not null or task_id is not null)
);

-- ────────────────────────────────────────────────────────────
-- No-show events (missed appointments → follow-up tasks)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_no_show_events (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id      uuid not null references public.primetime_appointments(id) on delete restrict,
  lead_id             uuid references public.primetime_leads(id) on delete restrict,
  detected_at         timestamptz not null default now(),
  recovery_task_id    uuid references public.primetime_tasks(id) on delete set null,
  recovery_created_at timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
create index if not exists primetime_appt_workspace_scheduled_idx
  on public.primetime_appointments(workspace_id, scheduled_at desc);
create index if not exists primetime_appt_lead_idx
  on public.primetime_appointments(lead_id, scheduled_at desc);
create index if not exists primetime_appt_owner_idx
  on public.primetime_appointments(owner_member_id, scheduled_at desc);
create index if not exists primetime_appt_status_idx
  on public.primetime_appointments(workspace_id, status);
create index if not exists primetime_reminder_remind_at_idx
  on public.primetime_reminders(remind_at) where status = 'pending';
create index if not exists primetime_no_show_workspace_idx
  on public.primetime_no_show_events(workspace_id, detected_at desc);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
alter table public.primetime_availability_rules enable row level security;
alter table public.primetime_appointments enable row level security;
alter table public.primetime_appointment_attendees enable row level security;
alter table public.primetime_reminders enable row level security;
alter table public.primetime_no_show_events enable row level security;

-- ────────────────────────────────────────────────────────────
-- updated_at triggers (reuse Release 1 touch function)
-- ────────────────────────────────────────────────────────────
create trigger primetime_availability_rules_updated_at
  before update on public.primetime_availability_rules
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_appointments_updated_at
  before update on public.primetime_appointments
  for each row execute function public.primetime_touch_updated_at();

commit;
