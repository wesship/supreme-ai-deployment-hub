-- PRIMETIME Release 3 — Governed Communications Foundation
-- Reconciled to the canonical primetime_* Release 1 base schema; production had not applied the superseded migration.
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
  body text not null,
  required_disclosures text[] not null default '{}',
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
    (status <> 'approved') or (approved_by is not null and approved_at is not null and effective_at is not null)
  ),
  constraint message_templates_effective_window check (expires_at is null or effective_at is null or expires_at > effective_at)
);

create table if not exists message_template_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  template_id uuid not null references message_templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','expired','retired','rejected')),
  body text not null,
  required_disclosures text[] not null default '{}',
  allowed_variables text[] not null default '{}',
  created_by uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create table if not exists communication_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  person_id uuid not null references public.primetime_people(id) on delete restrict,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  status text not null default 'unknown' check (status in ('unknown','allowed','do_not_contact','transactional_only')),
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'America/Denver',
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
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
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  compliance_state text not null default 'pending_review' check (compliance_state in ('pending_review','approved','blocked','not_required')),
  block_reason text,
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
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists communication_policy_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  communication_id uuid references communications(id) on delete restrict,
  person_id uuid references public.primetime_people(id) on delete restrict,
  channel text not null check (channel in ('email','sms','voice','mail','in_person')),
  check_type text not null check (check_type in ('consent','suppression','quiet_hours','frequency_cap','template_approval','disclosure','jurisdiction','licensed_review')),
  result text not null check (result in ('pass','warn','block')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  checked_by uuid,
  checked_at timestamptz not null default now()
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
      from suppression_records
      where workspace_id = new.workspace_id
        and person_id = new.person_id
        and channel = new.channel;

      if suppressed_count > 0 then
        raise exception 'Outbound communication blocked by suppression record';
      end if;

      select count(*) into consent_count
      from consent_records
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
    insert into communication_events (workspace_id, communication_id, event_type, metadata, created_by)
    values (new.workspace_id, new.id, 'created', jsonb_build_object('status', new.status, 'channel', new.channel), new.created_by);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into communication_events (workspace_id, communication_id, event_type, metadata, created_by)
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
