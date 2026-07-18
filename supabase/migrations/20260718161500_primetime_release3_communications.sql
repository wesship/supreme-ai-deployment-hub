-- PRIMETIME Release 3: Governed Communications
-- Canonical tables: message_templates, template_versions, communications,
--                   communication_events, communication_preferences, voice_call_records
-- Exit gates: no_communication_without_policy_check,
--             opt_outs_enforced_immediately,
--             every_outbound_message_has_template_or_approval

begin;

-- ────────────────────────────────────────────────────────────
-- Communication preferences (per-person, per-channel)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_communication_preferences (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  person_id       uuid not null references public.primetime_people(id) on delete restrict,
  channel         text not null check (channel in ('email','sms','voice','automated_voice','call_recording','data_processing','document_delivery')),
  allowed         boolean not null default false,
  updated_by      uuid references public.primetime_workspace_memberships(id),
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (workspace_id, person_id, channel)
);

-- ────────────────────────────────────────────────────────────
-- Message templates (draft → review → approved)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_message_templates (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  name            text not null,
  channel         text not null check (channel in ('email','sms','voice')),
  category        text not null,
  status          text not null default 'draft'
                    check (status in ('draft','pending_review','approved','archived')),
  approved_by     uuid references public.primetime_workspace_memberships(id),
  approved_at     timestamptz,
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Template versions (immutable content snapshots)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_template_versions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  template_id     uuid not null references public.primetime_message_templates(id) on delete restrict,
  version         integer not null default 1,
  subject         text,
  body            text not null,
  variables       jsonb not null default '[]',
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  unique (template_id, version)
);

-- ────────────────────────────────────────────────────────────
-- Communications (every outbound message record)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_communications (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  lead_id             uuid references public.primetime_leads(id) on delete restrict,
  person_id           uuid references public.primetime_people(id) on delete restrict,
  channel             text not null check (channel in ('email','sms','voice','automated_voice')),
  direction           text not null check (direction in ('outbound','inbound')),
  status              text not null default 'draft'
                        check (status in ('draft','queued','sending','sent','delivered','failed','bounced','opted_out')),
  template_version_id uuid references public.primetime_template_versions(id),
  subject             text,
  body                text,
  consent_verified    boolean not null default false,
  suppression_checked boolean not null default false,
  policy_check_passed boolean not null default false,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  sent_by             uuid references public.primetime_workspace_memberships(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint primetime_comm_has_recipient check (lead_id is not null or person_id is not null)
);

-- ────────────────────────────────────────────────────────────
-- Communication events (delivery tracking)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_communication_events (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.primetime_workspaces(id) on delete restrict,
  communication_id  uuid not null references public.primetime_communications(id) on delete restrict,
  event_type        text not null check (event_type in ('queued','sent','delivered','opened','clicked','bounced','complained','opted_out','failed')),
  occurred_at       timestamptz not null default now(),
  provider          text,
  provider_event_id text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Voice call records
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_voice_call_records (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.primetime_workspaces(id) on delete restrict,
  lead_id             uuid references public.primetime_leads(id) on delete restrict,
  person_id           uuid references public.primetime_people(id) on delete restrict,
  member_id           uuid references public.primetime_workspace_memberships(id),
  direction           text not null check (direction in ('outbound','inbound')),
  status              text not null check (status in ('initiated','ringing','in_progress','completed','failed','no_answer','busy','voicemail')),
  provider            text,
  provider_call_id    text,
  duration_seconds    integer,
  recording_url       text,
  recording_consent   boolean not null default false,
  started_at          timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
create index if not exists primetime_comm_workspace_created_idx
  on public.primetime_communications(workspace_id, created_at desc);
create index if not exists primetime_comm_lead_idx
  on public.primetime_communications(lead_id, created_at desc);
create index if not exists primetime_comm_status_idx
  on public.primetime_communications(workspace_id, status);
create index if not exists primetime_comm_events_comm_idx
  on public.primetime_communication_events(communication_id, occurred_at desc);
create index if not exists primetime_template_workspace_status_idx
  on public.primetime_message_templates(workspace_id, status);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
alter table public.primetime_communication_preferences enable row level security;
alter table public.primetime_message_templates enable row level security;
alter table public.primetime_template_versions enable row level security;
alter table public.primetime_communications enable row level security;
alter table public.primetime_communication_events enable row level security;
alter table public.primetime_voice_call_records enable row level security;

-- ────────────────────────────────────────────────────────────
-- Enforcement: no outbound communication without policy check
-- ────────────────────────────────────────────────────────────
create or replace function public.primetime_enforce_outbound_policy()
returns trigger language plpgsql as $$
begin
  if new.direction = 'outbound' and new.status not in ('draft') then
    if not (new.consent_verified and new.suppression_checked and new.policy_check_passed) then
      raise exception 'primetime: outbound communication requires consent_verified, suppression_checked, and policy_check_passed';
    end if;
  end if;
  return new;
end;
$$;

create trigger primetime_communications_outbound_policy
  before insert or update on public.primetime_communications
  for each row execute function public.primetime_enforce_outbound_policy();

-- ────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────
create trigger primetime_message_templates_updated_at
  before update on public.primetime_message_templates
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_communications_updated_at
  before update on public.primetime_communications
  for each row execute function public.primetime_touch_updated_at();

commit;
