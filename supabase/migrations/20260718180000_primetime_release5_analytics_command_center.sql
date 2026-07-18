-- PRIMETIME Release 5 — Analytics and Executive Command Center
-- Adds governed analytics snapshots, metric definitions, dashboard widgets,
-- funnel snapshots, agent performance snapshots, compliance snapshots,
-- AI action metric snapshots, and release governance observations.

create table if not exists public.analytics_metric_definitions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    pipeline_stage_id uuid references public.pipeline_stages(id) on delete set null,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
    workspace_id uuid references public.workspaces(id) on delete cascade,
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
from public.workspaces
where not exists (
    select 1 from public.analytics_metric_definitions amd where amd.workspace_id = workspaces.id and amd.metric_key = 'open_leads'
);

insert into public.analytics_metric_definitions (workspace_id, metric_key, name, description, category, calculation_method, source_tables)
select id, 'blocked_ai_actions', 'Blocked AI actions', 'Count of AI action ledger records blocked by governance.', 'ai_actions', 'count ai_action_ledger where action_status=blocked', array['ai_action_ledger']
from public.workspaces
where not exists (
    select 1 from public.analytics_metric_definitions amd where amd.workspace_id = workspaces.id and amd.metric_key = 'blocked_ai_actions'
);
