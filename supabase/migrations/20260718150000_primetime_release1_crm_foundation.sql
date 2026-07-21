begin;

create extension if not exists pgcrypto;

create table if not exists public.primetime_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.primetime_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.primetime_roles(code, name, description) values
  ('representative','Representative','Assigned leads, clients, tasks, appointments, and approved tools'),
  ('trainee','Trainee','Academy, simulations, and supervised CRM access'),
  ('trainer','Trainer','Training progress, simulations, and coaching records'),
  ('manager','Manager','Team pipelines, assignments, metrics, and approvals'),
  ('compliance_reviewer','Compliance Reviewer','Communications, scripts, disclosures, exceptions, and audit trails'),
  ('workspace_admin','Workspace Administrator','Workspace users, settings, integrations, and permissions'),
  ('platform_admin','Platform Administrator','Infrastructure and platform configuration only'),
  ('auditor','Auditor','Read-only access to approved records and logs')
on conflict (code) do nothing;

create table if not exists public.primetime_workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  user_id uuid not null,
  role_id uuid not null references public.primetime_roles(id),
  manager_user_id uuid,
  status text not null default 'active' check (status in ('active','invited','suspended','removed')),
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table if not exists public.primetime_people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  owner_user_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  normalized_email text generated always as (lower(nullif(email,''))) stored,
  normalized_phone text,
  lifecycle_status text not null default 'prospect' check (lifecycle_status in ('prospect','lead','client','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists primetime_people_workspace_email_unique
on public.primetime_people(workspace_id, normalized_email)
where normalized_email is not null;

create table if not exists public.primetime_households (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  name text not null,
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.primetime_household_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  household_id uuid not null references public.primetime_households(id) on delete cascade,
  person_id uuid not null references public.primetime_people(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(household_id, person_id)
);

create table if not exists public.primetime_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.primetime_workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  position integer not null,
  is_open boolean not null default true,
  required_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(workspace_id, code)
);

create table if not exists public.primetime_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  person_id uuid references public.primetime_people(id) on delete restrict,
  owner_user_id uuid not null,
  pipeline_stage_id uuid not null references public.primetime_pipeline_stages(id),
  source text not null,
  consent_state text not null default 'unknown' check (consent_state in ('unknown','granted','denied','revoked','not_required')),
  status text not null default 'open' check (status in ('open','won','lost','closed','archived')),
  next_action text,
  next_action_due_at timestamptz,
  last_activity_at timestamptz,
  aging_indicator text not null default 'new' check (aging_indicator in ('new','active','aging','stale','exception')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint primetime_open_lead_controls check (
    status <> 'open' or (
      owner_user_id is not null and
      pipeline_stage_id is not null and
      source is not null and length(source) > 0 and
      consent_state is not null and
      next_action is not null and length(next_action) > 0 and
      next_action_due_at is not null
    )
  )
);

create table if not exists public.primetime_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid not null references public.primetime_leads(id) on delete cascade,
  from_stage_id uuid references public.primetime_pipeline_stages(id),
  to_stage_id uuid not null references public.primetime_pipeline_stages(id),
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.primetime_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid references public.primetime_leads(id) on delete cascade,
  assigned_to_user_id uuid not null,
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.primetime_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  lead_id uuid references public.primetime_leads(id) on delete cascade,
  person_id uuid references public.primetime_people(id) on delete set null,
  actor_user_id uuid,
  activity_type text not null,
  channel text,
  outcome text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.primetime_consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  person_id uuid not null references public.primetime_people(id) on delete cascade,
  channel text not null check (channel in ('sms','email','voice','mail','in_person')),
  status text not null check (status in ('granted','denied','revoked','expired')),
  source text not null,
  captured_by_user_id uuid,
  captured_at timestamptz not null default now(),
  expires_at timestamptz,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists public.primetime_suppression_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  person_id uuid references public.primetime_people(id) on delete cascade,
  channel text check (channel in ('sms','email','voice','mail','all')),
  reason text not null,
  source text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.primetime_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid,
  actor_user_id uuid,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.primetime_release_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  exception_type text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists primetime_leads_workspace_owner_idx on public.primetime_leads(workspace_id, owner_user_id, status);
create index if not exists primetime_leads_next_action_idx on public.primetime_leads(workspace_id, next_action_due_at) where status = 'open';
create index if not exists primetime_tasks_assignee_due_idx on public.primetime_tasks(workspace_id, assigned_to_user_id, due_at);
create index if not exists primetime_activities_lead_created_idx on public.primetime_activities(lead_id, created_at desc);
create index if not exists primetime_audit_workspace_created_idx on public.primetime_audit_events(workspace_id, created_at desc);

alter table public.primetime_workspaces enable row level security;
alter table public.primetime_workspace_memberships enable row level security;
alter table public.primetime_people enable row level security;
alter table public.primetime_households enable row level security;
alter table public.primetime_household_members enable row level security;
alter table public.primetime_pipeline_stages enable row level security;
alter table public.primetime_leads enable row level security;
alter table public.primetime_stage_transitions enable row level security;
alter table public.primetime_tasks enable row level security;
alter table public.primetime_activities enable row level security;
alter table public.primetime_consent_records enable row level security;
alter table public.primetime_suppression_records enable row level security;
alter table public.primetime_audit_events enable row level security;
alter table public.primetime_release_exceptions enable row level security;

commit;
