-- Genesis deterministic evaluation, findings, and release-readiness records.

create table if not exists public.genesis_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  evaluation_type text not null default 'project_health',
  status text not null default 'running',
  scores jsonb not null default '{}'::jsonb,
  overall_score numeric(5,2),
  release_ready boolean not null default false,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id),
  created_by_agent_id uuid references public.genesis_agents(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint genesis_evaluation_status_check check (
    status in ('running','passed','passed_with_warnings','failed','cancelled')
  )
);

create table if not exists public.genesis_findings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  evaluation_run_id uuid references public.genesis_evaluation_runs(id) on delete cascade,
  severity text not null,
  category text not null,
  title text not null,
  description text,
  evidence jsonb not null default '{}'::jsonb,
  remediation text,
  blocking boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint genesis_findings_severity_check check (
    severity in ('info','low','medium','high','critical')
  ),
  constraint genesis_findings_status_check check (
    status in ('open','acknowledged','in_progress','resolved','accepted_risk','dismissed')
  )
);

create table if not exists public.genesis_release_gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.genesis_projects(id) on delete cascade,
  gate_key text not null,
  name text not null,
  category text not null,
  required boolean not null default true,
  status text not null default 'not_evaluated',
  evidence jsonb not null default '{}'::jsonb,
  evaluation_run_id uuid references public.genesis_evaluation_runs(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, gate_key),
  constraint genesis_release_gates_status_check check (
    status in ('not_evaluated','passed','warning','blocked','waived')
  )
);

create index if not exists genesis_evaluation_project_created_idx
  on public.genesis_evaluation_runs(project_id, created_at desc);
create index if not exists genesis_findings_project_status_idx
  on public.genesis_findings(project_id, status, severity);
create index if not exists genesis_release_gates_project_status_idx
  on public.genesis_release_gates(project_id, status);

alter table public.genesis_evaluation_runs enable row level security;
alter table public.genesis_findings enable row level security;
alter table public.genesis_release_gates enable row level security;

create policy genesis_evaluation_runs_select
on public.genesis_evaluation_runs
for select
using (public.genesis_has_project_access(project_id));

create policy genesis_findings_select
on public.genesis_findings
for select
using (public.genesis_has_project_access(project_id));

create policy genesis_release_gates_select
on public.genesis_release_gates
for select
using (public.genesis_has_project_access(project_id));

comment on table public.genesis_evaluation_runs is
  'Immutable snapshots of deterministic and AI-assisted project quality evaluations.';
comment on table public.genesis_findings is
  'Actionable quality, canon, security, accessibility, and release-readiness findings.';
comment on table public.genesis_release_gates is
  'Named release gates with exact evidence and explicit pass, warning, blocked, or waived state.';
