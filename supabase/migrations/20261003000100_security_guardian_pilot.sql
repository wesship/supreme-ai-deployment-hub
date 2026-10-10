-- D3VONN Security Guardian — client-safe pilot foundation
-- Isolated from legacy SOC tables so client multi-tenancy can be certified
-- before any legacy data is migrated.

create table if not exists public.security_guardian_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pilot' check (status in ('pilot','active','suspended','offboarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_guardian_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.security_guardian_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','security_manager','analyst','viewer')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.security_guardian_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.security_guardian_organizations(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 120),
  severity text not null default 'medium' check (severity in ('info','low','medium','high','critical')),
  source text not null check (char_length(source) between 1 and 120),
  actor text,
  ip_address inet,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  synthetic boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardian_events_org_time
  on public.security_guardian_events (organization_id, occurred_at desc);
create index if not exists idx_guardian_events_org_severity
  on public.security_guardian_events (organization_id, severity, occurred_at desc);

create table if not exists public.security_guardian_pilot_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.security_guardian_organizations(id) on delete cascade,
  status text not null check (status in ('blocked','ready','certified','expired')),
  score integer not null default 0 check (score between 0 and 100),
  checks jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  evidence_hash text not null,
  certified_by uuid references auth.users(id) on delete set null,
  certified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardian_cert_org_created
  on public.security_guardian_pilot_certifications (organization_id, created_at desc);

alter table public.security_guardian_organizations enable row level security;
alter table public.security_guardian_memberships enable row level security;
alter table public.security_guardian_events enable row level security;
alter table public.security_guardian_pilot_certifications enable row level security;

-- Direct client access is read-only. Mutations flow through authenticated backend
-- routes that re-check tenant membership while using the service role.
drop policy if exists guardian_org_select on public.security_guardian_organizations;
create policy guardian_org_select on public.security_guardian_organizations
for select to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.security_guardian_memberships m
    where m.organization_id = id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists guardian_membership_select_self on public.security_guardian_memberships;
create policy guardian_membership_select_self on public.security_guardian_memberships
for select to authenticated
using (user_id = auth.uid() and status = 'active');

drop policy if exists guardian_events_select on public.security_guardian_events;
create policy guardian_events_select on public.security_guardian_events
for select to authenticated
using (
  exists (
    select 1 from public.security_guardian_memberships m
    where m.organization_id = security_guardian_events.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists guardian_cert_select on public.security_guardian_pilot_certifications;
create policy guardian_cert_select on public.security_guardian_pilot_certifications
for select to authenticated
using (
  exists (
    select 1 from public.security_guardian_memberships m
    where m.organization_id = security_guardian_pilot_certifications.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

comment on table public.security_guardian_events is
  'Tenant-isolated Security Guardian pilot events. Client writes are backend-mediated.';
comment on table public.security_guardian_pilot_certifications is
  'Tamper-evident pilot readiness snapshots; evidence_hash is SHA-256 over canonical checks.';
