-- PRIMETIME governed runtime reconciliation
-- Forward-only recovery for the stacked Release 1–5 runtime. Historical migrations remain immutable.
-- Validated transactionally against PostgreSQL 17 before merge.


-- Reconcile the canonical Release 1 tables without rewriting migration history.
alter table public.primetime_workspaces add column if not exists slug text;
update public.primetime_workspaces
set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
where slug is null;
alter table public.primetime_workspaces alter column slug set not null;
create unique index if not exists primetime_workspaces_slug_unique on public.primetime_workspaces(slug);
alter table public.primetime_workspaces add column if not exists created_by uuid;

alter table public.primetime_people rename column owner_user_id to owner_id;
alter table public.primetime_people add column if not exists source text;
alter table public.primetime_people add column if not exists created_by uuid;

alter table public.primetime_households rename column owner_user_id to owner_id;
alter table public.primetime_households add column if not exists created_by uuid;

alter table public.primetime_leads rename column owner_user_id to owner_id;
alter table public.primetime_leads add column if not exists created_by uuid;
alter table public.primetime_leads drop constraint if exists primetime_leads_status_check;
alter table public.primetime_leads add constraint primetime_leads_status_check
  check (status in ('open','won','lost','closed','archived','converted','not_ready'));
alter table public.primetime_leads drop constraint if exists primetime_leads_consent_state_check;
alter table public.primetime_leads add constraint primetime_leads_consent_state_check
  check (consent_state in ('unknown','not_required','granted','denied','revoked','expired'));

alter table public.primetime_tasks rename column assigned_to_user_id to owner_id;
alter table public.primetime_tasks add column if not exists priority text not null default 'normal';
alter table public.primetime_tasks add column if not exists created_by uuid;
alter table public.primetime_tasks add column if not exists updated_at timestamptz not null default now();
alter table public.primetime_tasks add constraint primetime_tasks_priority_check
  check (priority in ('low','normal','high','urgent'));

alter table public.primetime_activities rename column actor_user_id to actor_id;
alter table public.primetime_activities add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.primetime_consent_records rename column status to consent_state;
alter table public.primetime_consent_records rename column captured_by_user_id to recorded_by;
alter table public.primetime_consent_records drop constraint if exists primetime_consent_records_status_check;
alter table public.primetime_consent_records add constraint primetime_consent_records_consent_state_check
  check (consent_state in ('unknown','not_required','granted','denied','revoked','expired'));

alter table public.primetime_suppression_records alter column source set default 'manual';
alter table public.primetime_suppression_records add column if not exists created_by uuid;

alter table public.primetime_audit_events rename column actor_user_id to actor_id;
alter table public.primetime_audit_events rename column event_type to action;
alter table public.primetime_audit_events rename column event_data to metadata;


create or replace function public.primetime_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.primetime_prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'primetime audit records are immutable';
end;
$$;

drop trigger if exists primetime_audit_events_immutable on public.primetime_audit_events;
create trigger primetime_audit_events_immutable
before update or delete on public.primetime_audit_events
for each row execute function public.primetime_prevent_audit_mutation();

create or replace function public.primetime_record_stage_transition()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.primetime_stage_transitions(workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values(new.workspace_id, new.id, null, new.pipeline_stage_id, new.owner_id, 'initial_stage');
    return new;
  end if;

  if old.pipeline_stage_id is distinct from new.pipeline_stage_id then
    insert into public.primetime_stage_transitions(workspace_id, lead_id, from_stage_id, to_stage_id, changed_by, reason)
    values(new.workspace_id, new.id, old.pipeline_stage_id, new.pipeline_stage_id, new.owner_id, 'stage_changed');
  end if;
  return new;
end;
$$;

drop trigger if exists primetime_lead_stage_transition on public.primetime_leads;
create trigger primetime_lead_stage_transition
after insert or update of pipeline_stage_id on public.primetime_leads
for each row execute function public.primetime_record_stage_transition();

create or replace function public.primetime_update_lead_last_activity()
returns trigger language plpgsql as $$
begin
  if new.lead_id is not null then
    update public.primetime_leads
    set last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at), updated_at = now()
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists primetime_activity_updates_lead on public.primetime_activities;
create trigger primetime_activity_updates_lead
after insert on public.primetime_activities
for each row execute function public.primetime_update_lead_last_activity();

create or replace function public.primetime_seed_pipeline_stages(target_workspace_id uuid)
returns void language plpgsql as $$
begin
  insert into public.primetime_pipeline_stages(workspace_id, code, name, position, is_open, required_fields) values
    (target_workspace_id, 'new_lead', 'New Lead', 10, true, '["owner_id","source","person_id"]'),
    (target_workspace_id, 'contact_attempted', 'Contact Attempted', 20, true, '["last_activity_at"]'),
    (target_workspace_id, 'contacted', 'Contacted', 30, true, '["consent_state","next_action"]'),
    (target_workspace_id, 'appointment_scheduled', 'Appointment Scheduled', 40, true, '["next_action_due_at"]'),
    (target_workspace_id, 'appointment_completed', 'Appointment Completed', 50, true, '["last_activity_at"]'),
    (target_workspace_id, 'needs_analysis', 'Needs Analysis', 60, true, '["last_activity_at"]'),
    (target_workspace_id, 'application_started', 'Application Started', 70, true, '["last_activity_at"]'),
    (target_workspace_id, 'application_submitted', 'Application Submitted', 80, true, '["last_activity_at"]'),
    (target_workspace_id, 'underwriting', 'Underwriting', 90, true, '["next_action_due_at"]'),
    (target_workspace_id, 'approved', 'Approved', 100, true, '["last_activity_at"]'),
    (target_workspace_id, 'policy_issued', 'Policy Issued', 110, false, '["last_activity_at"]'),
    (target_workspace_id, 'active_client', 'Active Client', 120, false, '["last_activity_at"]'),
    (target_workspace_id, 'not_ready', 'Not Ready', 130, false, '[]'),
    (target_workspace_id, 'closed', 'Closed', 140, false, '[]')
  on conflict(workspace_id, code) do nothing;
end;
$$;

create or replace function public.primetime_scan_release1_exceptions(target_workspace_id uuid)
returns integer language plpgsql as $$
declare inserted_count integer;
begin
  insert into public.primetime_release_exceptions(workspace_id, entity_type, entity_id, exception_type, severity, details)
  select
    l.workspace_id,
    'lead',
    l.id,
    'release1_open_lead_missing_required_control',
    'critical',
    jsonb_build_object(
      'missing_owner', l.owner_id is null,
      'missing_stage', l.pipeline_stage_id is null,
      'missing_source', l.source is null or length(l.source) = 0,
      'missing_next_action', l.next_action is null or length(l.next_action) = 0,
      'missing_next_action_due_at', l.next_action_due_at is null,
      'missing_last_activity', l.last_activity_at is null,
      'consent_state', l.consent_state
    )
  from public.primetime_leads l
  where l.workspace_id = target_workspace_id
    and l.status = 'open'
    and (
      l.owner_id is null
      or l.pipeline_stage_id is null
      or l.source is null
      or length(l.source) = 0
      or l.next_action is null
      or length(l.next_action) = 0
      or l.next_action_due_at is null
      or l.last_activity_at is null
      or l.consent_state = 'unknown'
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.primetime_initialize_workspace()
returns trigger language plpgsql as $$
begin
  perform public.primetime_seed_pipeline_stages(new.id);
  return new;
end;
$$;

drop trigger if exists primetime_workspace_initialize on public.primetime_workspaces;
create trigger primetime_workspace_initialize
after insert on public.primetime_workspaces
for each row execute function public.primetime_initialize_workspace();

select public.primetime_seed_pipeline_stages(id) from public.primetime_workspaces;


-- PRIMETIME Release 2 — Scheduling and Daily Operations
-- Adds appointment booking, attendees, availability rules, reminders, no-show recovery,
-- calendar-sync boundary records, immutable scheduling audit support, and release gate checks.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Appointment scheduling
-- -----------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete set null,
  household_id uuid references public.primetime_households(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  appointment_type text not null default 'consultation',
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','rescheduled','completed','cancelled','no_show')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'UTC',
  location_type text not null default 'virtual' check (location_type in ('virtual','phone','in_person')),
  location_value text,
  meeting_url text,
  consent_checked_at timestamptz,
  compliance_state text not null default 'pending' check (compliance_state in ('pending','passed','blocked','review_required')),
  source text not null default 'manual',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_appointments_workspace_start on public.appointments(workspace_id, start_at);
create index if not exists idx_appointments_owner_start on public.appointments(owner_id, start_at);
create index if not exists idx_appointments_status on public.appointments(workspace_id, status);

create table if not exists public.appointment_attendees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  person_id uuid references public.primetime_people(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  attendee_role text not null default 'participant' check (attendee_role in ('host','co_host','client','prospect','trainer','licensed_representative','attendee','participant')),
  attendance_status text not null default 'invited' check (attendance_status in ('invited','accepted','declined','tentative','attended','missed')),
  notification_channel text check (notification_channel in ('email','sms','voice','none')),
  consent_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(appointment_id, person_id),
  unique(appointment_id, user_id),
  check (person_id is not null or user_id is not null)
);

create index if not exists idx_appointment_attendees_appointment on public.appointment_attendees(appointment_id);
create index if not exists idx_appointment_attendees_workspace on public.appointment_attendees(workspace_id);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_name text not null,
  timezone text not null default 'UTC',
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 240),
  max_daily_appointments integer check (max_daily_appointments between 1 and 100),
  created_by uuid references auth.users(id) on delete set null,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_availability_rules_user_day on public.availability_rules(user_id, day_of_week, is_active);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete cascade,
  task_id uuid references public.primetime_tasks(id) on delete cascade,
  recipient_person_id uuid references public.primetime_people(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('email','sms','voice','in_app')),
  template_key text,
  status text not null default 'pending' check (status in ('pending','scheduled','sent','failed','cancelled','blocked')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  blocked_reason text,
  policy_check_state text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (appointment_id is not null or task_id is not null),
  check (recipient_person_id is not null or recipient_user_id is not null)
);

create index if not exists idx_reminders_workspace_due on public.reminders(workspace_id, scheduled_for, status);
create index if not exists idx_reminders_appointment on public.reminders(appointment_id);

create table if not exists public.no_show_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete set null,
  person_id uuid references public.primetime_people(id) on delete set null,
  recovery_task_id uuid references public.primetime_tasks(id) on delete set null,
  detected_at timestamptz not null default now(),
  recovery_status text not null default 'open' check (recovery_status in ('open','contacted','rescheduled','closed')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(appointment_id)
);

create table if not exists public.calendar_sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete cascade,
  provider text not null check (provider in ('google_calendar','microsoft_calendar','ical','manual')),
  external_calendar_id text,
  external_event_id text,
  direction text not null check (direction in ('inbound','outbound')),
  status text not null default 'pending' check (status in ('pending','synced','failed','blocked')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  synced_at timestamptz,
  authoritative boolean not null default false check (authoritative = false),
  created_by uuid references auth.users(id) on delete set null,
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
    if new.start_at is null or new.end_at is null or new.end_at <= new.start_at then
      raise exception 'Open appointment requires a valid time range';
    end if;
    if new.compliance_state = 'blocked' then
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
    insert into public.primetime_activities(workspace_id, lead_id, actor_id, activity_type, summary, metadata)
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
    insert into public.primetime_tasks(workspace_id, lead_id, owner_id, title, due_at, priority, status, created_by)
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
  insert into public.primetime_release_exceptions(workspace_id, entity_type, entity_id, exception_type, severity, status, details)
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
      ('MISSING_TIME_RANGE', 'critical', jsonb_build_object('field','start_at/end_at')),
      ('MISSING_COMPLIANCE_STATUS', 'high', jsonb_build_object('field','compliance_state'))
  ) as rules(exception_type, severity, details)
  where a.workspace_id = target_workspace
    and a.status in ('scheduled','confirmed','rescheduled')
    and (
      (rules.rule_code = 'MISSING_OWNER' and a.owner_id is null)
      or (rules.rule_code = 'MISSING_TIME_RANGE' and (a.start_at is null or a.end_at is null or a.end_at <= a.start_at))
      or (rules.rule_code = 'MISSING_COMPLIANCE_STATUS' and (a.compliance_state is null or a.compliance_state = 'blocked'))
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

drop policy if exists appointments_workspace_members on public.appointments;
create policy appointments_workspace_members on public.appointments
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = appointments.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = appointments.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

drop policy if exists appointment_attendees_workspace_members on public.appointment_attendees;
create policy appointment_attendees_workspace_members on public.appointment_attendees
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = appointment_attendees.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = appointment_attendees.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

drop policy if exists availability_rules_workspace_members on public.availability_rules;
create policy availability_rules_workspace_members on public.availability_rules
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = availability_rules.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = availability_rules.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

drop policy if exists reminders_workspace_members on public.reminders;
create policy reminders_workspace_members on public.reminders
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = reminders.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = reminders.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

drop policy if exists no_show_events_workspace_members on public.no_show_events;
create policy no_show_events_workspace_members on public.no_show_events
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = no_show_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = no_show_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

drop policy if exists calendar_sync_events_workspace_members on public.calendar_sync_events;
create policy calendar_sync_events_workspace_members on public.calendar_sync_events
  for all using (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = calendar_sync_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
  with check (exists (select 1 from public.primetime_workspace_memberships wm where wm.workspace_id = calendar_sync_events.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

-- PRIMETIME Release 3 — Governed Communications Foundation
-- Purpose: approved templates, consent/opt-out enforcement, quiet hours, frequency caps,
-- communication records, delivery events, and immutable audit-friendly communication history.

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  name text not null,
  purpose text not null,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  audience text,
  jurisdiction text,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','expired','retired','rejected')),
  body text not null default '',
  disclosures text[] not null default '{}',
  allowed_variables text[] not null default '{}',
  max_sends_per_person_per_day integer not null default 1 check (max_sends_per_person_per_day >= 0 and max_sends_per_person_per_day <= 10),
  approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  effective_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_approval_state check (
    (status <> 'approved') or (approved_by is not null and approved_at is not null)
  ),
  constraint message_templates_effective_window check (expires_at is null or effective_at is null or expires_at > effective_at)
);

create table if not exists message_template_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  template_id uuid not null references message_templates(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','expired','retired','rejected')),
  subject text,
  body text not null,
  disclosures text[] not null default '{}',
  allowed_variables text[] not null default '{}',
  effective_at timestamptz,
  expires_at timestamptz,
  approved_by uuid,
  created_by uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists communication_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  person_id uuid not null references public.primetime_people(id) on delete restrict,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  preference_state text not null default 'unknown' check (preference_state in ('unknown','allowed','do_not_contact','transactional_only')),
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'America/Denver',
  max_frequency_per_day integer check (max_frequency_per_day between 0 and 100),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, person_id, channel)
);

create table if not exists communication_frequency_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  person_id uuid not null references public.primetime_people(id) on delete restrict,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  counter_date date not null default current_date,
  send_count integer not null default 0 check (send_count >= 0),
  updated_at timestamptz not null default now(),
  unique (workspace_id, person_id, channel, counter_date)
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  person_id uuid references public.primetime_people(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete restrict,
  appointment_id uuid references appointments(id) on delete restrict,
  template_id uuid references message_templates(id) on delete restrict,
  template_version_id uuid references message_template_versions(id) on delete restrict,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound','internal')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','scheduled','blocked','sent','delivered','failed','responded','opted_out','cancelled')),
  subject text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  compliance_state text not null default 'pending_review' check (compliance_state in ('pending_review','approved','blocked','not_required')),
  blocked_reason text,
  approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communications_requires_approval_before_send check (
    status not in ('scheduled','sent','delivered') or compliance_state = 'approved'
  ),
  constraint communications_template_required_for_outbound check (
    direction <> 'outbound' or template_id is not null or status in ('draft','pending_review','blocked','cancelled')
  )
);

create table if not exists communication_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  communication_id uuid not null references communications(id) on delete restrict,
  event_type text not null check (event_type in ('created','review_requested','approved','blocked','scheduled','sent','delivered','failed','responded','opted_out','cancelled','provider_callback')),
  event_source text not null default 'primetime',
  provider text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists communication_policy_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  communication_id uuid references communications(id) on delete restrict,
  template_id uuid references message_templates(id) on delete restrict,
  channel text check (channel in ('email','sms','voice','mail','in_person')),
  decision text not null check (decision in ('pass','warn','block','review_required')),
  checks jsonb not null default '{}'::jsonb,
  reasons text[] not null default '{}',
  checked_by uuid,
  created_at timestamptz not null default now()
);

create or replace function primetime_touch_communications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger message_templates_touch_updated_at
before update on message_templates
for each row execute function primetime_touch_communications_updated_at();

create trigger communications_touch_updated_at
before update on communications
for each row execute function primetime_touch_communications_updated_at();

create or replace function primetime_block_unapproved_outbound_communications()
returns trigger
language plpgsql
as $$
declare
  template_status text;
  template_effective timestamptz;
  template_expires timestamptz;
  suppressed_count integer;
  consent_count integer;
begin
  if new.direction = 'outbound' and new.status in ('approved','scheduled','sent','delivered') then
    if new.template_id is null then
      raise exception 'Outbound communication requires an approved template before approval/scheduling/sending';
    end if;

    select status, effective_at, expires_at into template_status, template_effective, template_expires
    from message_templates
    where id = new.template_id and workspace_id = new.workspace_id;

    if template_status is distinct from 'approved' then
      raise exception 'Outbound communication requires approved template';
    end if;

    if template_effective is null or template_effective > now() or (template_expires is not null and template_expires <= now()) then
      raise exception 'Outbound communication template is not currently effective';
    end if;

    if new.person_id is not null then
      select count(*) into suppressed_count
      from public.primetime_suppression_records
      where workspace_id = new.workspace_id
        and person_id = new.person_id
        and channel = new.channel;

      if suppressed_count > 0 then
        raise exception 'Outbound communication blocked by suppression record';
      end if;

      select count(*) into consent_count
      from public.primetime_consent_records
      where workspace_id = new.workspace_id
        and person_id = new.person_id
        and channel = new.channel
        and consent_state in ('granted','not_required');

      if consent_count = 0 and new.channel in ('sms','email','voice') then
        raise exception 'Outbound communication requires consent or not-required attestation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger communications_block_unapproved_outbound
before insert or update on communications
for each row execute function primetime_block_unapproved_outbound_communications();

create or replace function primetime_log_communication_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into communication_events (workspace_id, communication_id, event_type, metadata, recorded_by)
    values (new.workspace_id, new.id, 'created', jsonb_build_object('status', new.status, 'channel', new.channel), new.created_by);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into communication_events (workspace_id, communication_id, event_type, metadata, recorded_by)
    values (new.workspace_id, new.id,
      case
        when new.status = 'approved' then 'approved'
        when new.status = 'blocked' then 'blocked'
        when new.status = 'scheduled' then 'scheduled'
        when new.status = 'sent' then 'sent'
        when new.status = 'delivered' then 'delivered'
        when new.status = 'failed' then 'failed'
        when new.status = 'responded' then 'responded'
        when new.status = 'opted_out' then 'opted_out'
        when new.status = 'cancelled' then 'cancelled'
        else 'provider_callback'
      end,
      jsonb_build_object('from', old.status, 'to', new.status, 'channel', new.channel), new.created_by);
  end if;
  return new;
end;
$$;

create trigger communications_log_event
 after insert or update on communications
 for each row execute function primetime_log_communication_event();

alter table message_templates enable row level security;
alter table message_template_versions enable row level security;
alter table communication_preferences enable row level security;
alter table communication_frequency_counters enable row level security;
alter table communications enable row level security;
alter table communication_events enable row level security;
alter table communication_policy_checks enable row level security;

comment on table communications is 'Governed communication records. Release 3 does not perform autonomous delivery; delivery integrations must consume approved/scheduled records only.';
comment on table communication_events is 'Append-oriented event history for communication lifecycle and provider callbacks.';
comment on table communication_policy_checks is 'Policy evaluation evidence for consent, suppression, quiet hours, frequency caps, template approval, disclosures, jurisdiction, and licensed review.';

-- PRIMETIME Release 4 — AI Assistance Foundation
-- Governed AI assistance layer for insurance CRM operations.
-- This migration intentionally does not create autonomous execution, product recommendation,
-- quote generation, policy decisioning, or outbound send capabilities.

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  key text not null,
  name text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','retired','disabled')),
  allowed_actions jsonb not null default '[]'::jsonb,
  blocked_actions jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create table if not exists public.ai_agent_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id uuid not null references public.ai_agents(id) on delete restrict,
  version integer not null check (version > 0),
  system_prompt text not null,
  model_policy jsonb not null default '{}'::jsonb,
  tool_policy jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','retired','disabled')),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (agent_id, version),
  constraint approved_agent_versions_require_reviewer check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table if not exists public.ai_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  requested_by uuid,
  agent_key text not null,
  assigned_agent_version_id uuid references public.ai_agent_versions(id) on delete restrict,
  request_type text not null,
  prompt text not null,
  status text not null default 'requested' check (status in ('requested','processing','draft_ready','review_required','blocked','approved','rejected','closed')),
  person_id uuid references public.primetime_people(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  communication_id uuid references public.communications(id) on delete restrict,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistance_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid not null references public.ai_assistance_requests(id) on delete restrict,
  output_type text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review_required','approved','rejected','superseded','blocked')),
  agent_id uuid references public.ai_agents(id) on delete restrict,
  agent_version_id uuid references public.ai_agent_versions(id) on delete restrict,
  requires_human_approval boolean not null default true,
  requires_licensed_review boolean not null default false,
  requires_compliance_review boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_action_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid references public.ai_assistance_requests(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  action_type text not null,
  action_status text not null default 'proposed' check (action_status in ('proposed','blocked','approval_required','approved','executed','rejected','failed')),
  target_table text,
  target_id uuid,
  proposed_payload jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  proposed_by uuid,
  blocked_reason text,
  approval_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  review_type text not null check (review_type in ('human','licensed','compliance','manager')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  action_id uuid references public.ai_action_ledger(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  reason text,
  due_at timestamptz,
  requested_by uuid,
  decided_by uuid,
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint decided_approvals_require_reviewer check (status not in ('approved','rejected') or (decided_by is not null and decided_at is not null))
);

create table if not exists public.ai_compliance_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid references public.ai_assistance_requests(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  action_id uuid references public.ai_action_ledger(id) on delete restrict,
  severity text not null check (severity in ('info','warning','critical','blocked')),
  rule_key text not null,
  finding text not null,
  recommendation text,
  status text not null default 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_citations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  output_id uuid not null references public.ai_assistance_outputs(id) on delete restrict,
  source_title text not null,
  source_type text not null,
  confidence numeric(4,3) check (confidence is null or (confidence between 0 and 1)),
  source_url text,
  source_version text,
  effective_date date,
  excerpt text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.ai_agents enable row level security;
alter table public.ai_agent_versions enable row level security;
alter table public.ai_assistance_requests enable row level security;
alter table public.ai_assistance_outputs enable row level security;
alter table public.ai_action_ledger enable row level security;
alter table public.ai_approval_requests enable row level security;
alter table public.ai_compliance_findings enable row level security;
alter table public.ai_knowledge_citations enable row level security;

create or replace function public.primetime_block_autonomous_regulated_ai_actions()
returns trigger
language plpgsql
as $$
begin
    if lower(coalesce(new.action_type, '')) in (
        'regulated_recommendation',
        'quote',
        'quote_generation',
        'policy_decision',
        'submit_application',
        'autonomous_send',
        'send_message',
        'place_call',
        'voice_call',
        'delete_record'
    ) then
        new.action_status := 'blocked';
        new.blocked_reason := coalesce(new.blocked_reason, 'Release 4 blocks autonomous regulated, delivery, and delete actions.');
    end if;
    return new;
end;
$$;

drop trigger if exists trg_block_autonomous_regulated_ai_actions on public.ai_action_ledger;
create trigger trg_block_autonomous_regulated_ai_actions
before insert or update on public.ai_action_ledger
for each row execute function public.primetime_block_autonomous_regulated_ai_actions();

create or replace function public.primetime_ai_approval_status_sync()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'approved' and new.decided_at is null then
        new.decided_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists trg_ai_approval_status_sync on public.ai_approval_requests;
create trigger trg_ai_approval_status_sync
before insert or update on public.ai_approval_requests
for each row execute function public.primetime_ai_approval_status_sync();

create or replace function public.primetime_ai_action_audit_event()
returns trigger
language plpgsql
as $$
begin
    insert into public.primetime_audit_events (
        workspace_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) values (
        new.workspace_id,
        new.proposed_by,
        'ai.action.' || new.action_status,
        'ai_action_ledger',
        new.id,
        jsonb_build_object(
            'request_id', new.request_id,
            'output_id', new.output_id,
            'action_type', new.action_type,
            'target_table', new.target_table,
            'blocked_reason', new.blocked_reason
        )
    );
    return new;
end;
$$;

drop trigger if exists trg_ai_action_audit_event on public.ai_action_ledger;
create trigger trg_ai_action_audit_event
after insert on public.ai_action_ledger
for each row execute function public.primetime_ai_action_audit_event();

-- Seed canonical Release 4 agent definitions. These are inactive until approved versions exist.
insert into public.ai_agents (workspace_id, name, key, purpose, blocked_actions)
select w.id, seed.name, seed.agent_key, seed.description, '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb
from public.primetime_workspaces w
cross join (values
    ('Intake Agent', 'intake_agent', 'Drafts intake summaries, duplicate-check suggestions, tags, and review tasks.', false, false),
    ('Follow-Up Agent', 'follow_up_agent', 'Drafts follow-up suggestions, reminders, and next-action recommendations.', false, false),
    ('Scheduling Agent', 'scheduling_agent', 'Suggests appointment times, reminder drafts, and no-show recovery actions.', false, false),
    ('Meeting Prep Agent', 'meeting_prep_agent', 'Creates supervised meeting briefs and disclosure reminders.', true, false),
    ('Compliance Reviewer Agent', 'compliance_reviewer_agent', 'Reviews drafts, templates, consent, suppression, and prohibited language.', false, true)
) as seed(name, agent_key, description, requires_licensed_review, requires_compliance_review)
on conflict (workspace_id, key) do nothing;

create or replace function public.primetime_seed_ai_agents_for_workspace()
returns trigger language plpgsql as $$
begin
  insert into public.ai_agents (workspace_id, name, key, purpose, blocked_actions)
  values
    (new.id, 'Intake Agent', 'intake_agent', 'Drafts intake summaries, duplicate-check suggestions, tags, and review tasks.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Follow-Up Agent', 'follow_up_agent', 'Drafts follow-up suggestions, reminders, and next-action recommendations.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Scheduling Agent', 'scheduling_agent', 'Suggests appointment times, reminder drafts, and no-show recovery actions.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Meeting Prep Agent', 'meeting_prep_agent', 'Creates supervised meeting briefs and disclosure reminders.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Compliance Reviewer Agent', 'compliance_reviewer_agent', 'Reviews drafts, templates, consent, suppression, and prohibited language.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb)
  on conflict (workspace_id, key) do nothing;
  return new;
end;
$$;

drop trigger if exists primetime_workspace_seed_ai_agents on public.primetime_workspaces;
create trigger primetime_workspace_seed_ai_agents
after insert on public.primetime_workspaces
for each row execute function public.primetime_seed_ai_agents_for_workspace();


-- PRIMETIME Release 5 — Analytics and Executive Command Center
-- Adds governed analytics snapshots, metric definitions, dashboard widgets,
-- funnel snapshots, agent performance snapshots, compliance snapshots,
-- AI action metric snapshots, and release governance observations.

create table if not exists public.analytics_metric_definitions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    metric_key text not null,
    name text not null,
    description text not null,
    category text not null check (category in ('funnel','pipeline','activity','scheduling','communications','ai_actions','compliance','release_governance','executive')),
    calculation_method text not null,
    source_tables text[] not null default '{}',
    owner_role text not null default 'workspace_admin',
    is_active boolean not null default true,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, metric_key)
);

create table if not exists public.executive_dashboards (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    name text not null,
    audience text not null check (audience in ('representative','manager','compliance','workspace_admin','executive')),
    description text,
    status text not null default 'draft' check (status in ('draft','active','retired')),
    layout jsonb not null default '{}'::jsonb,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_widgets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    dashboard_id uuid not null references public.executive_dashboards(id) on delete cascade,
    metric_definition_id uuid references public.analytics_metric_definitions(id) on delete set null,
    widget_key text not null,
    title text not null,
    widget_type text not null check (widget_type in ('stat','trend','table','funnel','timeline','alert','scorecard')),
    config jsonb not null default '{}'::jsonb,
    position_index integer not null default 0,
    status text not null default 'active' check (status in ('active','hidden','retired')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (dashboard_id, widget_key)
);

create table if not exists public.analytics_snapshots (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    metric_definition_id uuid references public.analytics_metric_definitions(id) on delete set null,
    metric_key text not null,
    snapshot_period text not null check (snapshot_period in ('hourly','daily','weekly','monthly','quarterly')),
    period_start timestamptz not null,
    period_end timestamptz not null,
    value numeric,
    numerator numeric,
    denominator numeric,
    dimensions jsonb not null default '{}'::jsonb,
    source_watermark timestamptz,
    generated_by text not null default 'system',
    created_at timestamptz not null default now(),
    check (period_start < period_end)
);

create table if not exists public.funnel_stage_snapshots (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    pipeline_stage_id uuid references public.primetime_pipeline_stages(id) on delete set null,
    stage_name text not null,
    snapshot_date date not null,
    lead_count integer not null default 0 check (lead_count >= 0),
    entered_count integer not null default 0 check (entered_count >= 0),
    exited_count integer not null default 0 check (exited_count >= 0),
    conversion_rate numeric check (conversion_rate is null or (conversion_rate >= 0 and conversion_rate <= 1)),
    median_age_hours numeric check (median_age_hours is null or median_age_hours >= 0),
    created_at timestamptz not null default now(),
    unique (workspace_id, stage_name, snapshot_date)
);

create table if not exists public.agent_performance_snapshots (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    agent_user_id uuid not null,
    snapshot_date date not null,
    assigned_lead_count integer not null default 0 check (assigned_lead_count >= 0),
    open_task_count integer not null default 0 check (open_task_count >= 0),
    completed_task_count integer not null default 0 check (completed_task_count >= 0),
    appointment_count integer not null default 0 check (appointment_count >= 0),
    no_show_count integer not null default 0 check (no_show_count >= 0),
    communication_draft_count integer not null default 0 check (communication_draft_count >= 0),
    ai_assistance_request_count integer not null default 0 check (ai_assistance_request_count >= 0),
    score numeric check (score is null or (score >= 0 and score <= 100)),
    created_at timestamptz not null default now(),
    unique (workspace_id, agent_user_id, snapshot_date)
);

create table if not exists public.compliance_metric_snapshots (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    snapshot_date date not null,
    open_exception_count integer not null default 0 check (open_exception_count >= 0),
    blocked_communication_count integer not null default 0 check (blocked_communication_count >= 0),
    blocked_ai_action_count integer not null default 0 check (blocked_ai_action_count >= 0),
    pending_approval_count integer not null default 0 check (pending_approval_count >= 0),
    unresolved_finding_count integer not null default 0 check (unresolved_finding_count >= 0),
    audit_event_count integer not null default 0 check (audit_event_count >= 0),
    compliance_score numeric check (compliance_score is null or (compliance_score >= 0 and compliance_score <= 100)),
    created_at timestamptz not null default now(),
    unique (workspace_id, snapshot_date)
);

create table if not exists public.ai_action_metric_snapshots (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
    snapshot_date date not null,
    proposed_count integer not null default 0 check (proposed_count >= 0),
    approval_required_count integer not null default 0 check (approval_required_count >= 0),
    approved_count integer not null default 0 check (approved_count >= 0),
    blocked_count integer not null default 0 check (blocked_count >= 0),
    rejected_count integer not null default 0 check (rejected_count >= 0),
    executed_count integer not null default 0 check (executed_count >= 0),
    high_risk_count integer not null default 0 check (high_risk_count >= 0),
    automation_savings_minutes numeric check (automation_savings_minutes is null or automation_savings_minutes >= 0),
    created_at timestamptz not null default now(),
    unique (workspace_id, snapshot_date)
);

create table if not exists public.release_governance_observations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references public.primetime_workspaces(id) on delete cascade,
    release_key text not null,
    observation_type text not null check (observation_type in ('exit_gate','risk','metric_gap','test_gap','policy_gap','incident','improvement')),
    severity text not null default 'info' check (severity in ('info','warning','critical','blocked')),
    title text not null,
    description text not null,
    status text not null default 'open' check (status in ('open','in_review','resolved','accepted_risk')),
    owner_id uuid,
    due_at timestamptz,
    resolved_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_analytics_metric_definitions_workspace on public.analytics_metric_definitions(workspace_id, category, is_active);
create index if not exists idx_executive_dashboards_workspace on public.executive_dashboards(workspace_id, audience, status);
create index if not exists idx_dashboard_widgets_dashboard on public.dashboard_widgets(dashboard_id, position_index);
create index if not exists idx_analytics_snapshots_workspace_metric on public.analytics_snapshots(workspace_id, metric_key, snapshot_period, period_start desc);
create index if not exists idx_funnel_stage_snapshots_workspace_date on public.funnel_stage_snapshots(workspace_id, snapshot_date desc);
create index if not exists idx_agent_performance_workspace_date on public.agent_performance_snapshots(workspace_id, snapshot_date desc);
create index if not exists idx_compliance_metrics_workspace_date on public.compliance_metric_snapshots(workspace_id, snapshot_date desc);
create index if not exists idx_ai_action_metrics_workspace_date on public.ai_action_metric_snapshots(workspace_id, snapshot_date desc);
create index if not exists idx_release_governance_observations_status on public.release_governance_observations(workspace_id, release_key, status, severity);

alter table public.analytics_metric_definitions enable row level security;
alter table public.executive_dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.funnel_stage_snapshots enable row level security;
alter table public.agent_performance_snapshots enable row level security;
alter table public.compliance_metric_snapshots enable row level security;
alter table public.ai_action_metric_snapshots enable row level security;
alter table public.release_governance_observations enable row level security;

-- Policies intentionally remain workspace-membership based and are enforced
-- by the runtime API. Direct Supabase access should be locked behind service role
-- or explicit workspace membership policies in deployment hardening.

create or replace function public.primetime_release5_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_analytics_metric_definitions_updated_at on public.analytics_metric_definitions;
create trigger trg_analytics_metric_definitions_updated_at
before update on public.analytics_metric_definitions
for each row execute function public.primetime_release5_touch_updated_at();

drop trigger if exists trg_executive_dashboards_updated_at on public.executive_dashboards;
create trigger trg_executive_dashboards_updated_at
before update on public.executive_dashboards
for each row execute function public.primetime_release5_touch_updated_at();

drop trigger if exists trg_dashboard_widgets_updated_at on public.dashboard_widgets;
create trigger trg_dashboard_widgets_updated_at
before update on public.dashboard_widgets
for each row execute function public.primetime_release5_touch_updated_at();

drop trigger if exists trg_release_governance_observations_updated_at on public.release_governance_observations;
create trigger trg_release_governance_observations_updated_at
before update on public.release_governance_observations
for each row execute function public.primetime_release5_touch_updated_at();

insert into public.analytics_metric_definitions (workspace_id, metric_key, name, description, category, calculation_method, source_tables)
select id, 'open_leads', 'Open leads', 'Count of active open leads by workspace.', 'funnel', 'count leads where status=open', array['leads']
from public.primetime_workspaces
where not exists (
    select 1 from public.analytics_metric_definitions amd where amd.workspace_id = primetime_workspaces.id and amd.metric_key = 'open_leads'
);

insert into public.analytics_metric_definitions (workspace_id, metric_key, name, description, category, calculation_method, source_tables)
select id, 'blocked_ai_actions', 'Blocked AI actions', 'Count of AI action ledger records blocked by governance.', 'ai_actions', 'count ai_action_ledger where action_status=blocked', array['ai_action_ledger']
from public.primetime_workspaces
where not exists (
    select 1 from public.analytics_metric_definitions amd where amd.workspace_id = primetime_workspaces.id and amd.metric_key = 'blocked_ai_actions'
);
