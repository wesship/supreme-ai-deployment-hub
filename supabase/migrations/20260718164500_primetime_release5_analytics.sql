-- PRIMETIME Release 5: Analytics Command Center
-- Canonical tables: analytics_snapshots, analytics_metrics, analytics_reports
-- Governance rule: analytics tables are snapshot-only — they record aggregated
--                  read-only views of CRM/scheduling/comms state. They must never
--                  mutate leads, people, communications, or audit records.

begin;

-- ────────────────────────────────────────────────────────────
-- Analytics snapshots (point-in-time aggregations)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_analytics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  snapshot_type   text not null check (snapshot_type in (
                    'pipeline_summary',
                    'activity_summary',
                    'communication_summary',
                    'appointment_summary',
                    'ai_action_summary',
                    'team_performance'
                  )),
  period_start    date not null,
  period_end      date not null,
  data            jsonb not null default '{}',
  generated_by    uuid references public.primetime_workspace_memberships(id),
  generated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint primetime_snapshot_period_order check (period_end >= period_start)
);

-- ────────────────────────────────────────────────────────────
-- Analytics metrics (named time-series data points)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_analytics_metrics (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  metric_name     text not null,
  metric_value    numeric not null,
  dimensions      jsonb not null default '{}',
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Analytics reports (saved report definitions)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_analytics_reports (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  name            text not null,
  description     text,
  report_type     text not null,
  config          jsonb not null default '{}',
  status          text not null default 'active' check (status in ('active','archived')),
  created_by      uuid references public.primetime_workspace_memberships(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
create index if not exists primetime_snapshot_workspace_type_period_idx
  on public.primetime_analytics_snapshots(workspace_id, snapshot_type, period_start desc);
create index if not exists primetime_metrics_workspace_name_idx
  on public.primetime_analytics_metrics(workspace_id, metric_name, recorded_at desc);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
alter table public.primetime_analytics_snapshots enable row level security;
alter table public.primetime_analytics_metrics enable row level security;
alter table public.primetime_analytics_reports enable row level security;

-- ────────────────────────────────────────────────────────────
-- Enforcement: analytics snapshots are immutable once written
-- ────────────────────────────────────────────────────────────
create or replace function public.primetime_prevent_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'primetime: analytics snapshots are immutable — create a new snapshot instead of updating';
end;
$$;

create trigger primetime_analytics_snapshots_immutable
  before update or delete on public.primetime_analytics_snapshots
  for each row execute function public.primetime_prevent_snapshot_mutation();

-- ────────────────────────────────────────────────────────────
-- updated_at trigger (reports only — snapshots and metrics are immutable)
-- ────────────────────────────────────────────────────────────
create trigger primetime_analytics_reports_updated_at
  before update on public.primetime_analytics_reports
  for each row execute function public.primetime_touch_updated_at();

commit;
