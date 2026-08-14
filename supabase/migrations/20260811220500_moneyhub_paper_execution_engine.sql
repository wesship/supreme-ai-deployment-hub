-- MoneyHub simulation-only paper execution engine
-- Adds positions, performance snapshots, circuit events, and atomic simulated fills.

begin;

create table if not exists public.moneyhub_paper_positions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.moneyhub_paper_runs(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  symbol text not null,
  asset_class text not null,
  quantity numeric(24,8) not null default 0 check (quantity >= 0),
  avg_cost numeric(24,8) not null default 0 check (avg_cost >= 0),
  last_price numeric(24,8) not null default 0 check (last_price >= 0),
  market_value numeric(24,8) not null default 0,
  unrealized_pnl numeric(24,8) not null default 0,
  realized_pnl numeric(24,8) not null default 0,
  updated_at timestamptz not null default now(),
  unique (run_id, symbol)
);

create table if not exists public.moneyhub_paper_performance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.moneyhub_paper_runs(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  nav numeric(24,8) not null,
  cash numeric(24,8) not null,
  gross_exposure numeric(24,8) not null default 0,
  realized_pnl numeric(24,8) not null default 0,
  unrealized_pnl numeric(24,8) not null default 0,
  return_pct numeric(18,8) not null default 0,
  drawdown_pct numeric(18,8) not null default 0,
  win_rate numeric(18,8),
  trade_count integer not null default 0,
  score numeric(18,8),
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.moneyhub_paper_circuit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.moneyhub_paper_runs(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  event_type text not null,
  reason text not null,
  severity text not null default 'warning',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moneyhub_paper_circuit_event_type_check check (event_type in ('risk_reject','drawdown_pause','daily_loss_pause','kill_switch','manual_pause')),
  constraint moneyhub_paper_circuit_severity_check check (severity in ('info','warning','critical'))
);

create index if not exists moneyhub_paper_positions_run_idx on public.moneyhub_paper_positions(run_id, symbol);
create index if not exists moneyhub_paper_performance_run_idx on public.moneyhub_paper_performance(run_id, measured_at desc);
create index if not exists moneyhub_paper_circuit_run_idx on public.moneyhub_paper_circuit_events(run_id, created_at desc);

alter table public.moneyhub_paper_positions enable row level security;
alter table public.moneyhub_paper_performance enable row level security;
alter table public.moneyhub_paper_circuit_events enable row level security;

grant all on public.moneyhub_paper_positions to service_role;
grant all on public.moneyhub_paper_performance to service_role;
grant all on public.moneyhub_paper_circuit_events to service_role;
grant select on public.moneyhub_paper_positions to authenticated;
grant select on public.moneyhub_paper_performance to authenticated;
grant select on public.moneyhub_paper_circuit_events to authenticated;

drop policy if exists moneyhub_paper_positions_owner_read on public.moneyhub_paper_positions;
create policy moneyhub_paper_positions_owner_read on public.moneyhub_paper_positions for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists moneyhub_paper_performance_owner_read on public.moneyhub_paper_performance;
create policy moneyhub_paper_performance_owner_read on public.moneyhub_paper_performance for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists moneyhub_paper_circuit_owner_read on public.moneyhub_paper_circuit_events;
create policy moneyhub_paper_circuit_owner_read on public.moneyhub_paper_circuit_events for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.moneyhub_paper_execute_order(
  p_owner_id uuid,
  p_order_id uuid,
  p_quote_price numeric,
  p_slippage_bps numeric default 0,
  p_fee numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.moneyhub_paper_orders%rowtype;
  v_run public.moneyhub_paper_runs%rowtype;
  v_position public.moneyhub_paper_positions%rowtype;
  v_fill_price numeric(24,8);
  v_fill_value numeric(24,8);
  v_new_qty numeric(24,8);
  v_new_avg numeric(24,8);
  v_realized numeric(24,8) := 0;
  v_cash numeric(24,8);
  v_fill_id uuid;
begin
  if p_quote_price is null or p_quote_price <= 0 then raise exception 'quote price must be > 0'; end if;
  if coalesce(p_fee,0) < 0 then raise exception 'fee cannot be negative'; end if;

  select * into v_order from public.moneyhub_paper_orders
  where id = p_order_id and owner_id = p_owner_id for update;
  if not found then raise exception 'paper order not found'; end if;
  if v_order.status not in ('pending','accepted') then raise exception 'paper order is not executable from status %', v_order.status; end if;

  select * into v_run from public.moneyhub_paper_runs
  where id = v_order.run_id and owner_id = p_owner_id for update;
  if not found then raise exception 'paper run not found'; end if;
  if v_run.run_type not in ('backtest','walk_forward','paper','shadow') then raise exception 'unsupported simulation run type'; end if;
  if v_run.status not in ('pending','running') then raise exception 'paper run is not executable from status %', v_run.status; end if;

  v_fill_price := case when v_order.side = 'buy'
    then p_quote_price * (1 + coalesce(p_slippage_bps,0) / 10000.0)
    else p_quote_price * (1 - coalesce(p_slippage_bps,0) / 10000.0)
  end;
  v_fill_value := round(v_order.quantity * v_fill_price, 8);
  v_cash := coalesce(v_run.ending_cash, v_run.starting_cash);

  select * into v_position from public.moneyhub_paper_positions
  where run_id = v_order.run_id and symbol = v_order.symbol for update;

  if v_order.side = 'buy' then
    if v_cash < v_fill_value + coalesce(p_fee,0) then raise exception 'insufficient paper cash'; end if;
    if found then
      v_new_qty := v_position.quantity + v_order.quantity;
      v_new_avg := case when v_new_qty = 0 then 0 else ((v_position.quantity * v_position.avg_cost) + v_fill_value) / v_new_qty end;
      update public.moneyhub_paper_positions set
        quantity = v_new_qty, avg_cost = v_new_avg, last_price = v_fill_price,
        market_value = v_new_qty * v_fill_price,
        unrealized_pnl = (v_fill_price - v_new_avg) * v_new_qty,
        updated_at = now()
      where id = v_position.id;
    else
      insert into public.moneyhub_paper_positions(owner_id,run_id,strategy_id,symbol,asset_class,quantity,avg_cost,last_price,market_value,unrealized_pnl)
      values(p_owner_id,v_order.run_id,v_order.strategy_id,v_order.symbol,v_order.asset_class,v_order.quantity,v_fill_price,v_fill_price,v_fill_value,0);
    end if;
    v_cash := v_cash - v_fill_value - coalesce(p_fee,0);
  else
    if not found or v_position.quantity < v_order.quantity then raise exception 'paper engine is long-only; insufficient position to sell'; end if;
    v_realized := (v_fill_price - v_position.avg_cost) * v_order.quantity - coalesce(p_fee,0);
    v_new_qty := v_position.quantity - v_order.quantity;
    update public.moneyhub_paper_positions set
      quantity = v_new_qty,
      last_price = v_fill_price,
      market_value = v_new_qty * v_fill_price,
      unrealized_pnl = (v_fill_price - avg_cost) * v_new_qty,
      realized_pnl = realized_pnl + v_realized,
      avg_cost = case when v_new_qty = 0 then 0 else avg_cost end,
      updated_at = now()
    where id = v_position.id;
    v_cash := v_cash + v_fill_value - coalesce(p_fee,0);
  end if;

  insert into public.moneyhub_paper_fills(owner_id,order_id,quantity,price,fee,slippage_bps)
  values(p_owner_id,p_order_id,v_order.quantity,v_fill_price,coalesce(p_fee,0),coalesce(p_slippage_bps,0)) returning id into v_fill_id;

  update public.moneyhub_paper_orders set status='filled', filled_at=now() where id=p_order_id;
  update public.moneyhub_paper_runs set
    status = case when status='pending' then 'running' else status end,
    started_at = coalesce(started_at, now()),
    ending_cash = v_cash,
    realized_pnl = realized_pnl + v_realized
  where id=v_order.run_id;

  return jsonb_build_object('fill_id',v_fill_id,'fill_price',v_fill_price,'cash',v_cash,'realized_pnl',v_realized);
end;
$$;

revoke all on function public.moneyhub_paper_execute_order(uuid,uuid,numeric,numeric,numeric) from public, anon, authenticated;
grant execute on function public.moneyhub_paper_execute_order(uuid,uuid,numeric,numeric,numeric) to service_role;

commit;
