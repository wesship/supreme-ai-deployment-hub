-- MoneyHub Agent P&L + paper-trading foundation
-- Adds revenue/cost attribution and simulation-only trading lifecycle objects.

begin;

create table if not exists public.moneyhub_attribution_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  amount numeric(24,8) not null check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3,12}$'),
  agent_name text,
  business_unit text,
  project_ref text,
  customer_ref text,
  source_type text not null default 'system',
  source_ref text,
  journal_id uuid references public.moneyhub_journals(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moneyhub_attribution_event_type_check check (
    event_type in ('revenue','expense','model_cost','infrastructure_cost','api_cost','labor_cost','commission','fee','refund')
  )
);

create index if not exists moneyhub_attribution_owner_time_idx
  on public.moneyhub_attribution_events(owner_id, occurred_at desc);
create index if not exists moneyhub_attribution_agent_idx
  on public.moneyhub_attribution_events(owner_id, agent_name, occurred_at desc)
  where agent_name is not null;

alter table public.moneyhub_attribution_events enable row level security;
grant all on public.moneyhub_attribution_events to service_role;
grant select on public.moneyhub_attribution_events to authenticated;

drop policy if exists moneyhub_attribution_owner_read on public.moneyhub_attribution_events;
create policy moneyhub_attribution_owner_read
  on public.moneyhub_attribution_events for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace view public.moneyhub_agent_pnl
with (security_invoker = true)
as
select
  owner_id,
  agent_name,
  currency,
  sum(case when event_type = 'revenue' then amount when event_type = 'refund' then -amount else 0 end)::numeric(24,8) as revenue,
  sum(case when event_type in ('expense','model_cost','infrastructure_cost','api_cost','labor_cost','commission','fee') then amount else 0 end)::numeric(24,8) as costs,
  (
    sum(case when event_type = 'revenue' then amount when event_type = 'refund' then -amount else 0 end)
    - sum(case when event_type in ('expense','model_cost','infrastructure_cost','api_cost','labor_cost','commission','fee') then amount else 0 end)
  )::numeric(24,8) as net_profit,
  min(occurred_at) as first_activity_at,
  max(occurred_at) as last_activity_at,
  count(*) as event_count
from public.moneyhub_attribution_events
where agent_name is not null
group by owner_id, agent_name, currency;

revoke all on public.moneyhub_agent_pnl from anon, authenticated;
grant select on public.moneyhub_agent_pnl to authenticated;
grant select on public.moneyhub_agent_pnl to service_role;

create table if not exists public.moneyhub_paper_strategies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  strategy_type text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft',
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3,12}$'),
  configuration jsonb not null default '{}'::jsonb,
  risk_profile jsonb not null default '{}'::jsonb,
  created_by_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name, version),
  constraint moneyhub_paper_strategy_type_check check (
    strategy_type in ('trend','mean_reversion','rebalance','arbitrage','market_making','ai_signal','options','crypto','custom')
  ),
  constraint moneyhub_paper_strategy_status_check check (
    status in ('draft','backtest','validated','paper','paused','retired')
  )
);

create table if not exists public.moneyhub_paper_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  run_type text not null default 'paper',
  status text not null default 'pending',
  starting_cash numeric(24,8) not null check (starting_cash > 0),
  ending_cash numeric(24,8),
  realized_pnl numeric(24,8) not null default 0,
  unrealized_pnl numeric(24,8) not null default 0,
  max_drawdown_pct numeric(9,6),
  started_at timestamptz,
  ended_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moneyhub_paper_run_type_check check (run_type in ('backtest','walk_forward','paper','shadow')),
  constraint moneyhub_paper_run_status_check check (status in ('pending','running','completed','failed','paused','cancelled')),
  constraint moneyhub_paper_run_drawdown_check check (max_drawdown_pct is null or (max_drawdown_pct >= 0 and max_drawdown_pct <= 100))
);

create table if not exists public.moneyhub_paper_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.moneyhub_paper_runs(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  symbol text not null,
  asset_class text not null,
  side text not null,
  order_type text not null default 'market',
  quantity numeric(24,8) not null check (quantity > 0),
  limit_price numeric(24,8),
  status text not null default 'pending',
  risk_decision jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  filled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint moneyhub_paper_order_asset_check check (asset_class in ('equity','etf','crypto','fx','option','rwa','cash','other')),
  constraint moneyhub_paper_order_side_check check (side in ('buy','sell')),
  constraint moneyhub_paper_order_type_check check (order_type in ('market','limit','stop','stop_limit')),
  constraint moneyhub_paper_order_status_check check (status in ('pending','rejected','accepted','filled','partially_filled','cancelled'))
);

create table if not exists public.moneyhub_paper_fills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.moneyhub_paper_orders(id) on delete cascade,
  quantity numeric(24,8) not null check (quantity > 0),
  price numeric(24,8) not null check (price >= 0),
  fee numeric(24,8) not null default 0 check (fee >= 0),
  slippage_bps numeric(12,6) not null default 0,
  filled_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists moneyhub_paper_strategies_owner_idx on public.moneyhub_paper_strategies(owner_id, status);
create index if not exists moneyhub_paper_runs_owner_idx on public.moneyhub_paper_runs(owner_id, created_at desc);
create index if not exists moneyhub_paper_orders_run_idx on public.moneyhub_paper_orders(run_id, submitted_at desc);
create index if not exists moneyhub_paper_fills_order_idx on public.moneyhub_paper_fills(order_id, filled_at desc);

do $$
declare t text;
begin
  foreach t in array array['moneyhub_paper_strategies','moneyhub_paper_runs','moneyhub_paper_orders','moneyhub_paper_fills'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists moneyhub_paper_strategies_owner_read on public.moneyhub_paper_strategies;
create policy moneyhub_paper_strategies_owner_read on public.moneyhub_paper_strategies for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists moneyhub_paper_runs_owner_read on public.moneyhub_paper_runs;
create policy moneyhub_paper_runs_owner_read on public.moneyhub_paper_runs for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists moneyhub_paper_orders_owner_read on public.moneyhub_paper_orders;
create policy moneyhub_paper_orders_owner_read on public.moneyhub_paper_orders for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists moneyhub_paper_fills_owner_read on public.moneyhub_paper_fills;
create policy moneyhub_paper_fills_owner_read on public.moneyhub_paper_fills for select to authenticated using (owner_id = (select auth.uid()));

drop trigger if exists moneyhub_paper_strategies_set_updated_at on public.moneyhub_paper_strategies;
create trigger moneyhub_paper_strategies_set_updated_at
before update on public.moneyhub_paper_strategies
for each row execute function public.moneyhub_set_updated_at();

commit;
