-- D3VONN Operations Center
-- Persistent health evidence, incidents, alerts, remediations, approvals, and audit history.

create extension if not exists pgcrypto;

create table if not exists public.ops_health_checks (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status text not null check (status in ('healthy','degraded','unhealthy','unknown')),
  latency_ms integer,
  source text not null default 'operations-agent',
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists idx_ops_health_component_time
  on public.ops_health_checks(component, checked_at desc);

create table if not exists public.ops_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  severity text not null check (severity in ('info','low','medium','high','critical')),
  component text not null,
  title text not null,
  status text not null default 'open' check (status in ('open','investigating','mitigated','resolved','accepted')),
  root_cause text,
  probable_cause text,
  impact text,
  evidence jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(fingerprint, status)
);

create index if not exists idx_ops_incidents_status_severity
  on public.ops_incidents(status, severity, updated_at desc);

create table if not exists public.ops_alerts (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.ops_incidents(id) on delete cascade,
  channel text not null,
  destination text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','suppressed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.ops_remediations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.ops_incidents(id) on delete set null,
  action_type text not null,
  component text not null,
  risk_tier text not null check (risk_tier in ('low','medium','high','protected')),
  requested_by text not null,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected','expired')),
  execution_status text not null default 'queued' check (execution_status in ('queued','running','succeeded','failed','rolled_back','canceled')),
  reason text not null,
  command_reference text,
  rollback_reference text,
  evidence jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.ops_approvals (
  id uuid primary key default gen_random_uuid(),
  remediation_id uuid not null references public.ops_remediations(id) on delete cascade,
  approver_id uuid,
  decision text not null check (decision in ('approved','rejected')),
  rationale text,
  decided_at timestamptz not null default now()
);

create table if not exists public.ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('human','agent','system')),
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ops_health_checks enable row level security;
alter table public.ops_incidents enable row level security;
alter table public.ops_alerts enable row level security;
alter table public.ops_remediations enable row level security;
alter table public.ops_approvals enable row level security;
alter table public.ops_audit_events enable row level security;

-- Service-role access is intentional. Authenticated dashboard reads are granted only
-- to active workspace admins through API-layer authorization; direct anonymous access
-- receives no policy and is therefore denied.

grant select, insert, update on public.ops_health_checks to service_role;
grant select, insert, update on public.ops_incidents to service_role;
grant select, insert, update on public.ops_alerts to service_role;
grant select, insert, update on public.ops_remediations to service_role;
grant select, insert on public.ops_approvals to service_role;
grant select, insert on public.ops_audit_events to service_role;

create or replace function public.ops_open_incident(
  p_fingerprint text,
  p_severity text,
  p_component text,
  p_title text,
  p_impact text default null,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.ops_incidents(fingerprint,severity,component,title,impact,evidence)
  values (p_fingerprint,p_severity,p_component,p_title,p_impact,p_evidence)
  on conflict (fingerprint,status) do update
    set updated_at = now(), severity = excluded.severity, impact = excluded.impact,
        evidence = public.ops_incidents.evidence || excluded.evidence
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.ops_open_incident(text,text,text,text,text,jsonb) to service_role;
