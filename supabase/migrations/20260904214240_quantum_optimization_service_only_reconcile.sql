-- Reconcile the quantum optimization ledger to the verified service-only access model.
-- Staging was used to validate this migration before any production promotion.
-- RLS remains enabled with no API-facing policies by design; anon/authenticated
-- table grants are explicitly revoked so the Data API cannot expose these ledgers.

create table if not exists public.quantum_optimization_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_id text not null unique,
  provider text not null,
  backend text not null,
  objective_type text not null default 'binary_allocation',
  baseline_objective numeric not null,
  candidate_objective numeric not null,
  improvement numeric not null default 0,
  estimated_cost_usd numeric not null default 0,
  quantum_advantage boolean not null default false,
  selection jsonb not null default '[]'::jsonb,
  input_digest text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('queued','running','completed','failed','blocked')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.quantum_optimization_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  metric_value numeric not null,
  provider text,
  backend text,
  dimensions jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists quantum_optimization_experiments_advantage_idx
  on public.quantum_optimization_experiments (quantum_advantage);
create index if not exists quantum_optimization_experiments_created_at_idx
  on public.quantum_optimization_experiments (created_at desc);
create index if not exists quantum_optimization_experiments_provider_idx
  on public.quantum_optimization_experiments (provider);
create index if not exists quantum_optimization_metrics_observed_at_idx
  on public.quantum_optimization_metrics (observed_at desc);

alter table public.quantum_optimization_experiments enable row level security;
alter table public.quantum_optimization_metrics enable row level security;

revoke all on table public.quantum_optimization_experiments from anon, authenticated;
revoke all on table public.quantum_optimization_metrics from anon, authenticated;

grant all on table public.quantum_optimization_experiments to service_role;
grant all on table public.quantum_optimization_metrics to service_role;

comment on table public.quantum_optimization_experiments is
  'Service-only quantum optimization experiment ledger. RLS intentionally has no API-facing policies.';
comment on table public.quantum_optimization_metrics is
  'Service-only quantum optimization metrics ledger. RLS intentionally has no API-facing policies.';
