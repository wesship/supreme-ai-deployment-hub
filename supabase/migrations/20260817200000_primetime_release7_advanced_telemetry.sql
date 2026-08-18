-- PRIMETIME Release 7 — Advanced Telemetry and Observability
-- Governed operational telemetry only. These tables must never carry customer
-- payloads, message bodies, credentials, or raw regulated records.

create or replace function public.primetime_release7_safe_dimensions(input jsonb)
returns boolean
language sql
immutable
as $$
    select jsonb_typeof(input) = 'object'
       and (select count(*) from jsonb_object_keys(input)) <= 12;
$$;

create table if not exists public.primetime_telemetry_signals (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    metric_key text not null check (char_length(metric_key) between 1 and 160),
    domain text not null check (domain in ('runtime','deployment','agent','scheduler','queue','compliance','infrastructure','release')),
    value numeric not null check (value >= 0),
    unit text not null default 'count' check (char_length(unit) between 1 and 64),
    observed_at timestamptz not null,
    source text not null default 'system' check (char_length(source) between 1 and 120),
    correlation_id text check (correlation_id is null or char_length(correlation_id) <= 160),
    deployment_version text check (deployment_version is null or char_length(deployment_version) <= 160),
    dimensions jsonb not null default '{}'::jsonb check (public.primetime_release7_safe_dimensions(dimensions)),
    recorded_by uuid,
    created_at timestamptz not null default now()
);

create table if not exists public.primetime_slo_definitions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    name text not null check (char_length(name) between 1 and 160),
    metric_key text not null check (char_length(metric_key) between 1 and 160),
    domain text not null check (domain in ('runtime','deployment','agent','scheduler','queue','compliance','infrastructure','release')),
    comparator text not null check (comparator in ('lte','gte')),
    target_value numeric not null check (target_value >= 0),
    warning_threshold numeric check (warning_threshold is null or warning_threshold >= 0),
    evaluation_window_seconds integer not null default 300 check (evaluation_window_seconds between 60 and 604800),
    severity text not null default 'warning' check (severity in ('warning','critical')),
    status text not null default 'active' check (status in ('active','paused','retired')),
    description text not null default '' check (char_length(description) <= 1000),
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, metric_key, name),
    check (
      warning_threshold is null
      or (comparator = 'lte' and warning_threshold < target_value)
      or (comparator = 'gte' and warning_threshold > target_value)
    )
);

create table if not exists public.primetime_slo_evaluations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    slo_definition_id uuid not null references public.primetime_slo_definitions(id) on delete restrict,
    source_signal_id uuid references public.primetime_telemetry_signals(id) on delete restrict,
    measured_value numeric not null check (measured_value >= 0),
    evaluation_status text not null check (evaluation_status in ('compliant','warning','breached')),
    evaluated_at timestamptz not null default now(),
    window_start timestamptz,
    window_end timestamptz,
    evaluation_metadata jsonb not null default '{}'::jsonb check (public.primetime_release7_safe_dimensions(evaluation_metadata)),
    evaluated_by uuid,
    created_at timestamptz not null default now(),
    check (window_start is null or window_end is null or window_start < window_end)
);

create table if not exists public.primetime_telemetry_alerts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    slo_evaluation_id uuid not null references public.primetime_slo_evaluations(id) on delete restrict,
    slo_definition_id uuid not null references public.primetime_slo_definitions(id) on delete restrict,
    severity text not null check (severity in ('warning','critical')),
    status text not null default 'open' check (status in ('open','acknowledged','resolved','silenced')),
    title text not null check (char_length(title) between 1 and 240),
    description text not null default '' check (char_length(description) <= 2000),
    opened_at timestamptz not null default now(),
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    silenced_at timestamptz,
    lifecycle_updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (slo_evaluation_id)
);

create index if not exists idx_primetime_telemetry_signals_workspace_metric_time
    on public.primetime_telemetry_signals(workspace_id, metric_key, observed_at desc);
create index if not exists idx_primetime_telemetry_signals_workspace_domain_time
    on public.primetime_telemetry_signals(workspace_id, domain, observed_at desc);
create index if not exists idx_primetime_slo_definitions_workspace_status
    on public.primetime_slo_definitions(workspace_id, status, domain);
create index if not exists idx_primetime_slo_evaluations_workspace_slo_time
    on public.primetime_slo_evaluations(workspace_id, slo_definition_id, evaluated_at desc);
create index if not exists idx_primetime_telemetry_alerts_workspace_status_time
    on public.primetime_telemetry_alerts(workspace_id, status, opened_at desc);

alter table public.primetime_telemetry_signals enable row level security;
alter table public.primetime_slo_definitions enable row level security;
alter table public.primetime_slo_evaluations enable row level security;
alter table public.primetime_telemetry_alerts enable row level security;

create or replace function public.primetime_release7_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.primetime_release7_prevent_history_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'primetime telemetry history is immutable';
end;
$$;

create or replace function public.primetime_release7_prevent_delete()
returns trigger
language plpgsql
as $$
begin
    raise exception 'primetime release 7 records cannot be deleted';
end;
$$;

drop trigger if exists trg_primetime_telemetry_signals_immutable on public.primetime_telemetry_signals;
create trigger trg_primetime_telemetry_signals_immutable
before update or delete on public.primetime_telemetry_signals
for each row execute function public.primetime_release7_prevent_history_mutation();

drop trigger if exists trg_primetime_slo_evaluations_immutable on public.primetime_slo_evaluations;
create trigger trg_primetime_slo_evaluations_immutable
before update or delete on public.primetime_slo_evaluations
for each row execute function public.primetime_release7_prevent_history_mutation();

drop trigger if exists trg_primetime_slo_definitions_no_delete on public.primetime_slo_definitions;
create trigger trg_primetime_slo_definitions_no_delete
before delete on public.primetime_slo_definitions
for each row execute function public.primetime_release7_prevent_delete();

drop trigger if exists trg_primetime_telemetry_alerts_no_delete on public.primetime_telemetry_alerts;
create trigger trg_primetime_telemetry_alerts_no_delete
before delete on public.primetime_telemetry_alerts
for each row execute function public.primetime_release7_prevent_delete();

drop trigger if exists trg_primetime_slo_definitions_updated_at on public.primetime_slo_definitions;
create trigger trg_primetime_slo_definitions_updated_at
before update on public.primetime_slo_definitions
for each row execute function public.primetime_release7_touch_updated_at();

drop trigger if exists trg_primetime_telemetry_alerts_updated_at on public.primetime_telemetry_alerts;
create trigger trg_primetime_telemetry_alerts_updated_at
before update on public.primetime_telemetry_alerts
for each row execute function public.primetime_release7_touch_updated_at();

comment on table public.primetime_telemetry_signals is
    'Release 7 operational telemetry only; customer data, message bodies, credentials, and raw payloads are prohibited.';
comment on table public.primetime_slo_evaluations is
    'Release 7 immutable SLO evaluation history.';
