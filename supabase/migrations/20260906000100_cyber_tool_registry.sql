-- D3VONN Cyber Tool Registry persistence and execution audit

create table if not exists public.security_tool_registry (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null unique,
  name text not null,
  category text not null,
  risk_tier text not null check (risk_tier in ('green','yellow','red')),
  status text not null check (status in ('approved','sandbox_only','restricted','deprecated')),
  execution_mode text not null,
  capabilities jsonb not null default '[]'::jsonb,
  agent_access jsonb not null default '{}'::jsonb,
  logging_policy jsonb not null default '{}'::jsonb,
  source_url text not null,
  source_origin text not null default 'd3vonn_baseline',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_tool_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null references public.security_tool_registry(tool_id),
  capability text not null,
  actor text not null,
  environment text not null,
  decision text not null check (decision in ('allow','deny','approval_required')),
  reason text not null,
  asset_authorized boolean not null default false,
  human_approved boolean not null default false,
  request_id text,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.security_tool_executions (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null references public.security_tool_registry(tool_id),
  capability text not null,
  actor text not null,
  environment text not null,
  execution_class text not null check (execution_class in ('passive','active','restricted')),
  status text not null check (status in ('requested','blocked','approved','running','succeeded','failed')),
  target_type text,
  target_value text,
  asset_id uuid,
  policy_decision_id uuid references public.security_tool_policy_decisions(id),
  provider_request_id text,
  result_summary jsonb not null default '{}'::jsonb,
  error text,
  tenant_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_tool_policy_decisions_tool_created
  on public.security_tool_policy_decisions(tool_id, created_at desc);
create index if not exists idx_security_tool_executions_tool_created
  on public.security_tool_executions(tool_id, created_at desc);
create index if not exists idx_security_tool_executions_status
  on public.security_tool_executions(status, created_at desc);

alter table public.security_tool_registry enable row level security;
alter table public.security_tool_policy_decisions enable row level security;
alter table public.security_tool_executions enable row level security;

-- Internal control-plane state. No anon/authenticated policies are created.
-- Backend service-role access is expected; browser clients must use governed APIs.
-- asset_id remains a UUID without a foreign key so this migration can deploy before
-- the wider SOC schema; production can add the FK after security_assets is present.

comment on table public.security_tool_registry is 'Governed catalog of cyber capabilities exposed to Hermes metadata/policy workflows.';
comment on table public.security_tool_policy_decisions is 'Immutable audit trail of allow/deny/approval decisions for cyber capabilities.';
comment on table public.security_tool_executions is 'Execution ledger for governed cyber tool invocations; active/restricted use remains approval-gated.';
