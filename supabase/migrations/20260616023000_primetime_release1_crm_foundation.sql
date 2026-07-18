begin;

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  system_key text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, system_key)
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role_id uuid references public.roles(id) on delete set null,
  manager_user_id uuid,
  status text not null default 'active' check (status in ('active','invited','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid,
  first_name text,
  last_name text,
  preferred_name text,
  email text,
  phone text,
  normalized_email text generated always as (lower(nullif(email, ''))) stored,
  normalized_phone text,
  source text,
  status text not null default 'active' check (status in ('active','archived','duplicate','do_not_contact')),
  dedupe_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  owner_user_id uuid,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, person_id)
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  system_key text not null,
  name text not null,
  position integer not null,
  is_closed boolean not null default false,
  required_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (workspace_id, system_key),
  unique (workspace_id, position)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  owner_user_id uuid not null,
  source text not null,
  stage_id uuid not null references public.pipeline_stages(id),
  consent_state text not null default 'unknown' check (consent_state in ('unknown','permitted','restricted','opted_out','blocked')),
  next_action text not null,
  next_action_due_at timestamptz not null,
  last_activity_at timestamptz,
  aging_started_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','won','lost','not_ready','closed','exception')),
  exception_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id),
  to_stage_id uuid not null references public.pipeline_stages(id),
  changed_by uuid,
  reason text,
  changed_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  assigned_to uuid not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled','blocked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  actor_user_id uuid,
  activity_type text not null,
  channel text,
  outcome text,
  occurred_at timestamptz not null default now(),
  summary text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  channel text not null check (channel in ('sms','email','voice','mail','in_person')),
  status text not null check (status in ('unknown','granted','revoked','expired','blocked')),
  source text not null,
  evidence text,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.suppression_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  channel text not null check (channel in ('sms','email','voice','mail','all')),
  reason text not null,
  scope text not null default 'workspace' check (scope in ('workspace','global','campaign')),
  created_by uuid,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create table if not exists public.release_gate_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  rule_key text not null,
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','waived')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists workspace_memberships_user_idx on public.workspace_memberships(user_id, status);
create index if not exists people_workspace_owner_idx on public.people(workspace_id, owner_user_id);
create index if not exists people_workspace_email_idx on public.people(workspace_id, normalized_email);
create index if not exists leads_workspace_owner_status_idx on public.leads(workspace_id, owner_user_id, status);
create index if not exists leads_next_action_idx on public.leads(workspace_id, next_action_due_at) where status = 'open';
create index if not exists tasks_assignee_due_idx on public.tasks(workspace_id, assigned_to, due_at) where status in ('open','in_progress');
create index if not exists activities_lead_time_idx on public.activities(lead_id, occurred_at desc);
create index if not exists consent_person_channel_idx on public.consent_records(person_id, channel, created_at desc);
create index if not exists suppression_person_channel_idx on public.suppression_records(person_id, channel) where lifted_at is null;
create index if not exists audit_workspace_time_idx on public.audit_events(workspace_id, occurred_at desc);

alter table public.workspaces enable row level security;
alter table public.roles enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.people enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.stage_transitions enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.consent_records enable row level security;
alter table public.suppression_records enable row level security;
alter table public.audit_events enable row level security;
alter table public.release_gate_exceptions enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.prevent_audit_update_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'immutable audit records cannot be changed';
end;
$$;

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.prevent_audit_update_delete();

create policy workspaces_member_select on public.workspaces for select using (public.is_workspace_member(id));
create policy memberships_self_or_workspace_select on public.workspace_memberships for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy roles_member_all on public.roles for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy people_member_all on public.people for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy households_member_all on public.households for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy household_members_member_all on public.household_members for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy pipeline_stages_member_all on public.pipeline_stages for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy leads_member_all on public.leads for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy stage_transitions_member_all on public.stage_transitions for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy tasks_member_all on public.tasks for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy activities_member_insert_select on public.activities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy consent_member_all on public.consent_records for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy suppression_member_all on public.suppression_records for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy audit_member_insert_select on public.audit_events for insert with check (public.is_workspace_member(workspace_id));
create policy audit_member_select on public.audit_events for select using (public.is_workspace_member(workspace_id));
create policy gate_exceptions_member_all on public.release_gate_exceptions for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

commit;
