-- PRIMETIME Release 2 — Scheduling and Daily Operations
-- Adds appointment booking, attendees, availability rules, reminders, no-show recovery,
-- calendar-sync boundary records, immutable scheduling audit support, and release gate checks.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Appointment scheduling
-- -----------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  owner_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  meeting_type text not null default 'consultation',
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','rescheduled','completed','canceled','no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  location_type text not null default 'virtual' check (location_type in ('virtual','phone','in_person')),
  location_details jsonb not null default '{}'::jsonb,
  consent_checked_at timestamptz,
  compliance_status text not null default 'pending' check (compliance_status in ('pending','passed','blocked','review_required')),
  source text not null default 'manual',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_appointments_workspace_start on public.appointments(workspace_id, starts_at);
create index if not exists idx_appointments_owner_start on public.appointments(owner_id, starts_at);
create index if not exists idx_appointments_status on public.appointments(workspace_id, status);

create table if not exists public.appointment_attendees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  role text not null default 'attendee' check (role in ('host','co_host','client','prospect','trainer','licensed_representative','attendee')),
  attendance_status text not null default 'invited' check (attendance_status in ('invited','accepted','declined','tentative','attended','missed')),
  notification_channel text check (notification_channel in ('email','sms','voice','none')),
  created_at timestamptz not null default now(),
  unique(appointment_id, person_id),
  unique(appointment_id, user_id),
  check (person_id is not null or user_id is not null)
);

create index if not exists idx_appointment_attendees_appointment on public.appointment_attendees(appointment_id);
create index if not exists idx_appointment_attendees_workspace on public.appointment_attendees(workspace_id);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  timezone text not null default 'UTC',
  day_of_week int not null check (day_of_week between 0 and 6),
  starts_at_time time not null,
  ends_at_time time not null,
  is_active boolean not null default true,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at_time > starts_at_time)
);

create index if not exists idx_availability_rules_user_day on public.availability_rules(user_id, day_of_week, is_active);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('email','sms','voice','in_app')),
  reminder_type text not null default 'appointment_reminder',
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','canceled','blocked')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  blocked_reason text,
  policy_check jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (appointment_id is not null or task_id is not null),
  check (person_id is not null or user_id is not null)
);

create index if not exists idx_reminders_workspace_due on public.reminders(workspace_id, scheduled_for, status);
create index if not exists idx_reminders_appointment on public.reminders(appointment_id);

create table if not exists public.no_show_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  recovery_task_id uuid references public.tasks(id) on delete set null,
  detected_at timestamptz not null default now(),
  recovery_status text not null default 'open' check (recovery_status in ('open','contacted','rescheduled','closed')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(appointment_id)
);

create table if not exists public.calendar_sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete cascade,
  provider text not null check (provider in ('google_calendar','microsoft_calendar','ical','manual')),
  provider_calendar_id text,
  provider_event_id text,
  direction text not null check (direction in ('inbound','outbound')),
  status text not null default 'pending' check (status in ('pending','synced','failed','blocked')),
  request_hash text,
  error_message text,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_sync_workspace on public.calendar_sync_events(workspace_id, created_at desc);
create index if not exists idx_calendar_sync_appointment on public.calendar_sync_events(appointment_id);

-- -----------------------------------------------------------------------------
-- Updated-at helper
-- -----------------------------------------------------------------------------

create or replace function public.primetime_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appointments_touch_updated_at on public.appointments;
create trigger trg_appointments_touch_updated_at
before update on public.appointments
for each row execute function public.primetime_touch_updated_at();

drop trigger if exists trg_availability_touch_updated_at on public.availability_rules;
create trigger trg_availability_touch_updated_at
before update on public.availability_rules
for each row execute function public.primetime_touch_updated_at();

drop trigger if exists trg_reminders_touch_updated_at on public.reminders;
create trigger trg_reminders_touch_updated_at
before update on public.reminders
for each row execute function public.primetime_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Appointment status enforcement and no-show recovery
-- -----------------------------------------------------------------------------

create or replace function public.primetime_enforce_appointment_controls()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('scheduled','confirmed','rescheduled') then
    if new.owner_id is null then
      raise exception 'Open appointment requires an owner';
    end if;
    if new.title is null or btrim(new.title) = '' then
      raise exception 'Open appointment requires a title';
    end if;
    if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
      raise exception 'Open appointment requires a valid time range';
    end if;
    if new.compliance_status = 'blocked' then
      raise exception 'Blocked appointment cannot be scheduled';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_enforce_controls on public.appointments;
create trigger trg_appointments_enforce_controls
before insert or update on public.appointments
for each row execute function public.primetime_enforce_appointment_controls();

create or replace function public.primetime_after_appointment_status_change()
returns trigger
language plpgsql
as $$
declare
  recovery_task uuid;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.activities(workspace_id, lead_id, actor_id, activity_type, summary, metadata)
    values (
      new.workspace_id,
      new.lead_id,
      new.created_by,
      'appointment_status_change',
      'Appointment status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('appointment_id', new.id, 'from', old.status, 'to', new.status)
    );
  end if;

  if new.status = 'no_show' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.tasks(workspace_id, lead_id, owner_id, title, due_at, priority, status, created_by)
    values (
      new.workspace_id,
      new.lead_id,
      new.owner_id,
      'Recover no-show appointment',
      now() + interval '1 day',
      'high',
      'open',
      new.created_by
    )
    returning id into recovery_task;

    insert into public.no_show_events(workspace_id, appointment_id, lead_id, recovery_task_id, created_by)
    values (new.workspace_id, new.id, new.lead_id, recovery_task, new.created_by)
    on conflict (appointment_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_after_status_change on public.appointments;
create trigger trg_appointments_after_status_change
after insert or update on public.appointments
for each row execute function public.primetime_after_appointment_status_change();

-- -----------------------------------------------------------------------------
-- Release 2 exception scanner
-- -----------------------------------------------------------------------------

create or replace function public.primetime_scan_release2_scheduling_exceptions(target_workspace uuid)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  insert into public.release_exceptions(workspace_id, entity_type, entity_id, rule_code, severity, status, details)
  select
    a.workspace_id,
    'appointment',
    a.id,
    rule_code,
    severity,
    'open',
    details
  from public.appointments a
  cross join lateral (
    values
      ('MISSING_OWNER', 'critical', jsonb_build_object('field','owner_id')),
      ('MISSING_TIME_RANGE', 'critical', jsonb_build_object('field','starts_at/ends_at')),
      ('MISSING_COMPLIANCE_STATUS', 'high', jsonb_build_object('field','compliance_status'))
  ) as rules(rule_code, severity, details)
  where a.workspace_id = target_workspace
    and a.status in ('scheduled','confirmed','rescheduled')
    and (
      (rules.rule_code = 'MISSING_OWNER' and a.owner_id is null)
      or (rules.rule_code = 'MISSING_TIME_RANGE' and (a.starts_at is null or a.ends_at is null or a.ends_at <= a.starts_at))
      or (rules.rule_code = 'MISSING_COMPLIANCE_STATUS' and (a.compliance_status is null or a.compliance_status = 'blocked'))
    )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS enablement. Policies are intentionally simple and depend on membership.
-- API-level checks still enforce role-specific behavior.
-- -----------------------------------------------------------------------------

alter table public.appointments enable row level security;
alter table public.appointment_attendees enable row level security;
alter table public.availability_rules enable row level security;
alter table public.reminders enable row level security;
alter table public.no_show_events enable row level security;
alter table public.calendar_sync_events enable row level security;

create policy if not exists appointments_workspace_members on public.appointments
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = appointments.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = appointments.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy if not exists appointment_attendees_workspace_members on public.appointment_attendees
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = appointment_attendees.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = appointment_attendees.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy if not exists availability_rules_workspace_members on public.availability_rules
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = availability_rules.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = availability_rules.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy if not exists reminders_workspace_members on public.reminders
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = reminders.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = reminders.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy if not exists no_show_events_workspace_members on public.no_show_events
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = no_show_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = no_show_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy if not exists calendar_sync_events_workspace_members on public.calendar_sync_events
  for all using (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = calendar_sync_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.workspace_memberships wm where wm.workspace_id = calendar_sync_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));
