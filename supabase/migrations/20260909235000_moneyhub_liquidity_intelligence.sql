-- MoneyHub Liquidity Intelligence Layer
-- Read-only intelligence and proposal primitives. No custody, signing, transfer, swap,
-- deposit, withdrawal, or brokerage execution is introduced by this migration.

create table if not exists public.liquidity_protocols (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  protocol_type text not null check (protocol_type in ('amm','lending','vault','bridge','other')),
  chain text not null,
  website_url text,
  is_approved boolean not null default false,
  risk_tier text not null default 'unrated' check (risk_tier in ('low','medium','high','unrated')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.liquidity_pools (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.liquidity_protocols(id) on delete cascade,
  external_id text not null,
  chain text not null,
  pool_address text,
  symbol text not null,
  token0_symbol text,
  token1_symbol text,
  fee_tier_bps integer,
  tvl_usd numeric(30,8),
  volume_24h_usd numeric(30,8),
  fees_24h_usd numeric(30,8),
  apr_pct numeric(12,6),
  apy_pct numeric(12,6),
  utilization_pct numeric(12,6),
  volatility_30d_pct numeric(12,6),
  peg_deviation_pct numeric(12,6),
  source text not null default 'unknown',
  observed_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(protocol_id, external_id)
);

create table if not exists public.liquidity_risk_scores (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.liquidity_pools(id) on delete cascade,
  overall_score numeric(6,2) not null check (overall_score >= 0 and overall_score <= 100),
  smart_contract_score numeric(6,2) check (smart_contract_score between 0 and 100),
  liquidity_score numeric(6,2) check (liquidity_score between 0 and 100),
  volatility_score numeric(6,2) check (volatility_score between 0 and 100),
  asset_quality_score numeric(6,2) check (asset_quality_score between 0 and 100),
  oracle_score numeric(6,2) check (oracle_score between 0 and 100),
  bridge_score numeric(6,2) check (bridge_score between 0 and 100),
  depeg_score numeric(6,2) check (depeg_score between 0 and 100),
  concentration_score numeric(6,2) check (concentration_score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  scored_at timestamptz not null default now(),
  scorer_version text not null default 'liquidity-risk-v1'
);

create table if not exists public.liquidity_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.liquidity_pools(id) on delete cascade,
  strategy_type text not null check (strategy_type in ('amm_lp','concentrated_lp','lending','vault','reserve')),
  opportunity_score numeric(6,2) not null check (opportunity_score between 0 and 100),
  expected_net_apy_pct numeric(12,6),
  estimated_monthly_income_usd numeric(30,8),
  benchmark_return_pct numeric(12,6),
  max_suggested_allocation_usd numeric(30,8),
  rationale jsonb not null default '[]'::jsonb,
  status text not null default 'observed' check (status in ('observed','shortlisted','dismissed','expired')),
  observed_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Composite uniqueness is required so proposal references cannot cross tenant boundaries.
create unique index if not exists ux_money_agents_id_user_id
  on public.money_agents(id, user_id);
create unique index if not exists ux_liquidity_opportunities_id_user_id
  on public.liquidity_opportunities(id, user_id);

create table if not exists public.liquidity_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  money_agent_id uuid,
  opportunity_id uuid,
  action text not null check (action in ('ADD_LIQUIDITY','SUPPLY','REMOVE_LIQUIDITY','WITHDRAW','REBALANCE','HOLD')),
  amount_usd numeric(30,8),
  proposal_payload jsonb not null default '{}'::jsonb,
  policy_result jsonb not null default '{}'::jsonb,
  simulation_result jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','ready_for_approval','approved','rejected','expired')),
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint liquidity_proposals_money_agent_owner_fk
    foreign key (money_agent_id, user_id)
    references public.money_agents(id, user_id)
    on delete restrict,
  constraint liquidity_proposals_opportunity_owner_fk
    foreign key (opportunity_id, user_id)
    references public.liquidity_opportunities(id, user_id)
    on delete restrict
);

create index if not exists idx_liquidity_pools_observed_at on public.liquidity_pools(observed_at desc);
create index if not exists idx_liquidity_risk_scores_pool_scored on public.liquidity_risk_scores(pool_id, scored_at desc);
create index if not exists idx_liquidity_opportunities_user_score on public.liquidity_opportunities(user_id, opportunity_score desc);
create index if not exists idx_liquidity_proposals_user_state on public.liquidity_proposals(user_id, state, created_at desc);

alter table public.liquidity_protocols enable row level security;
alter table public.liquidity_pools enable row level security;
alter table public.liquidity_risk_scores enable row level security;
alter table public.liquidity_opportunities enable row level security;
alter table public.liquidity_proposals enable row level security;

-- Public intelligence tables are authenticated-read only. Service/backend roles own mutation.
drop policy if exists liquidity_protocols_authenticated_read on public.liquidity_protocols;
create policy liquidity_protocols_authenticated_read on public.liquidity_protocols
  for select to authenticated using (true);

drop policy if exists liquidity_pools_authenticated_read on public.liquidity_pools;
create policy liquidity_pools_authenticated_read on public.liquidity_pools
  for select to authenticated using (true);

drop policy if exists liquidity_risk_scores_authenticated_read on public.liquidity_risk_scores;
create policy liquidity_risk_scores_authenticated_read on public.liquidity_risk_scores
  for select to authenticated using (true);

drop policy if exists liquidity_opportunities_owner_read on public.liquidity_opportunities;
create policy liquidity_opportunities_owner_read on public.liquidity_opportunities
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists liquidity_proposals_owner_read on public.liquidity_proposals;
create policy liquidity_proposals_owner_read on public.liquidity_proposals
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.liquidity_protocols from anon, authenticated;
revoke insert, update, delete on public.liquidity_pools from anon, authenticated;
revoke insert, update, delete on public.liquidity_risk_scores from anon, authenticated;
revoke insert, update, delete on public.liquidity_opportunities from anon, authenticated;
revoke insert, update, delete on public.liquidity_proposals from anon, authenticated;

grant select on public.liquidity_protocols to authenticated;
grant select on public.liquidity_pools to authenticated;
grant select on public.liquidity_risk_scores to authenticated;
grant select on public.liquidity_opportunities to authenticated;
grant select on public.liquidity_proposals to authenticated;

comment on table public.liquidity_proposals is 'Non-executing MoneyHub liquidity intents. Approval records do not sign or broadcast transactions.';
