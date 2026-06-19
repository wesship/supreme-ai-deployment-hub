-- DevonnBench v1 — Supabase Schema
-- Run this migration BEFORE the first CI benchmark run.
-- Migration: 20260101000000_devonnbench_v1.sql

-- ============================================================
-- Benchmark runs — one row per suite execution
-- ============================================================
create table if not exists public.devonn_benchmark_runs (
  id                  bigint generated always as identity primary key,
  run_id              uuid        not null unique,
  suite_name          text        not null,
  suite_version       text        not null,
  devonn_version      text,
  git_commit          text,
  environment         text        not null,
  overall_score       numeric(6,2) not null,
  passed              boolean     not null,
  critical_failures   text[]      not null default '{}',
  category_scores     jsonb       not null default '[]',
  total_cases         integer     not null,
  executed_cases      integer     not null default 0,
  passed_cases        integer     not null,
  failed_cases        integer     not null default 0,
  skipped_cases       integer     not null default 0,
  total_latency_ms    numeric(12,2),
  estimated_cost_usd  numeric(10,6),
  threshold           numeric(6,2) not null default 80,
  artifact_path       text,
  started_at          timestamptz not null,
  finished_at         timestamptz not null,
  duration_seconds    numeric(10,3),
  created_at          timestamptz not null default now()
);

-- ============================================================
-- Benchmark cases — one row per case per run
-- ============================================================
create table if not exists public.devonn_benchmark_cases (
  id                  bigint generated always as identity primary key,
  run_id              uuid        not null references public.devonn_benchmark_runs(run_id) on delete cascade,
  case_id             text        not null,
  case_name           text        not null,
  category            text        not null,
  passed              boolean     not null,
  score               numeric(5,4) not null,
  skipped             boolean     not null default false,
  skip_reason         text,
  http_status         integer,
  latency_ms          numeric(10,2),
  assertion_results   jsonb       not null default '[]',
  critical_failure    text,
  estimated_cost_usd  numeric(10,6),
  response_excerpt    text,
  execution_error     text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_benchmark_runs_environment
  on public.devonn_benchmark_runs(environment);

create index if not exists idx_benchmark_runs_passed
  on public.devonn_benchmark_runs(passed);

create index if not exists idx_benchmark_runs_started_at
  on public.devonn_benchmark_runs(started_at desc);

create index if not exists idx_benchmark_runs_env_started_at
  on public.devonn_benchmark_runs(environment, started_at desc);

create index if not exists idx_benchmark_runs_git_commit
  on public.devonn_benchmark_runs(git_commit);

create index if not exists idx_benchmark_cases_run_id
  on public.devonn_benchmark_cases(run_id);

create index if not exists idx_benchmark_cases_category
  on public.devonn_benchmark_cases(category);

create index if not exists idx_benchmark_cases_critical_failure
  on public.devonn_benchmark_cases(critical_failure)
  where critical_failure is not null;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.devonn_benchmark_runs  enable row level security;
alter table public.devonn_benchmark_cases enable row level security;

-- Service role (CI/CD) can read and write
create policy "service_role_all_runs" on public.devonn_benchmark_runs
  for all using (auth.role() = 'service_role');

create policy "service_role_all_cases" on public.devonn_benchmark_cases
  for all using (auth.role() = 'service_role');

-- Authenticated users (OCC dashboard) can read
create policy "authenticated_read_runs" on public.devonn_benchmark_runs
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_cases" on public.devonn_benchmark_cases
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Convenience view: latest run per environment
-- ============================================================
create or replace view public.v_benchmark_latest_by_env as
select distinct on (environment)
  run_id,
  environment,
  suite_name,
  git_commit,
  overall_score,
  passed,
  critical_failures,
  total_cases,
  executed_cases,
  passed_cases,
  failed_cases,
  skipped_cases,
  started_at
from public.devonn_benchmark_runs
order by environment, started_at desc;

-- ============================================================
-- Convenience view: score trend (last 30 runs per environment)
-- ============================================================
create or replace view public.v_benchmark_score_trend as
select
  run_id,
  environment,
  suite_name,
  git_commit,
  overall_score,
  passed,
  critical_failure_count,
  started_at,
  recency_rank
from (
  select
    run_id,
    environment,
    suite_name,
    git_commit,
    overall_score,
    passed,
    cardinality(critical_failures) as critical_failure_count,
    started_at,
    row_number() over (partition by environment order by started_at desc) as recency_rank
  from public.devonn_benchmark_runs
) ranked
where recency_rank <= 30;

comment on table public.devonn_benchmark_runs  is 'DevonnBench v1 — one row per benchmark suite execution';
comment on table public.devonn_benchmark_cases is 'DevonnBench v1 — individual case results per run';
comment on view  public.v_benchmark_latest_by_env   is 'Latest benchmark run per deployment environment';
comment on view  public.v_benchmark_score_trend     is 'Score trend: last 30 runs per environment';
