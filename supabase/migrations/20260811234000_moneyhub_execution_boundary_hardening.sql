-- MoneyHub paper execution boundary hardening
-- Enforces strategy/run/order ownership consistency and safe simulation inputs
-- at the database RPC boundary, independent of API validation.

begin;

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
  v_strategy public.moneyhub_paper_strategies%rowtype;
  v_position public.moneyhub_paper_positions%rowtype;
  v_fill_price numeric(24,8);
  v_fill_value numeric(24,8);
  v_new_qty numeric(24,8);
  v_new_avg numeric(24,8);
  v_realized numeric(24,8) := 0;
  v_cash numeric(24,8);
  v_fill_id uuid;
begin
  if p_owner_id is null then raise exception 'owner_id is required'; end if;
  if p_quote_price is null or p_quote_price <= 0 then raise exception 'quote price must be > 0'; end if;
  if coalesce(p_slippage_bps,0) < 0 or coalesce(p_slippage_bps,0) > 1000 then
    raise exception 'slippage_bps must be between 0 and 1000';
  end if;
  if coalesce(p_fee,0) < 0 then raise exception 'fee cannot be negative'; end if;

  select * into v_order
  from public.moneyhub_paper_orders
  where id = p_order_id and owner_id = p_owner_id
  for update;
  if not found then raise exception 'paper order not found'; end if;
  if v_order.status not in ('pending','accepted') then
    raise exception 'paper order is not executable from status %', v_order.status;
  end if;

  select * into v_run
  from public.moneyhub_paper_runs
  where id = v_order.run_id and owner_id = p_owner_id
  for update;
  if not found then raise exception 'paper run not found'; end if;
  if v_run.strategy_id <> v_order.strategy_id then
    raise exception 'paper order strategy does not match run strategy';
  end if;
  if v_run.run_type not in ('backtest','walk_forward','paper','shadow') then
    raise exception 'unsupported simulation run type';
  end if;
  if v_run.status not in ('pending','running') then
    raise exception 'paper run is not executable from status %', v_run.status;
  end if;

  select * into v_strategy
  from public.moneyhub_paper_strategies
  where id = v_order.strategy_id and owner_id = p_owner_id;
  if not found then raise exception 'paper strategy not found for owner'; end if;
  if v_strategy.id <> v_run.strategy_id then
    raise exception 'paper strategy identity mismatch';
  end if;
  if v_strategy.status in ('retired') then
    raise exception 'retired strategy cannot execute simulated orders';
  end if;

  v_fill_price := case when v_order.side = 'buy'
    then p_quote_price * (1 + coalesce(p_slippage_bps,0) / 10000.0)
    else p_quote_price * (1 - coalesce(p_slippage_bps,0) / 10000.0)
  end;
  if v_fill_price <= 0 then raise exception 'simulated fill price must be > 0'; end if;
  v_fill_value := round(v_order.quantity * v_fill_price, 8);
  v_cash := coalesce(v_run.ending_cash, v_run.starting_cash);

  select * into v_position
  from public.moneyhub_paper_positions
  where run_id = v_order.run_id and symbol = v_order.symbol
  for update;

  if v_order.side = 'buy' then
    if v_cash < v_fill_value + coalesce(p_fee,0) then raise exception 'insufficient paper cash'; end if;
    if found then
      if v_position.owner_id <> p_owner_id or v_position.strategy_id <> v_order.strategy_id then
        raise exception 'paper position ownership or strategy mismatch';
      end if;
      v_new_qty := v_position.quantity + v_order.quantity;
      v_new_avg := case when v_new_qty = 0 then 0 else ((v_position.quantity * v_position.avg_cost) + v_fill_value) / v_new_qty end;
      update public.moneyhub_paper_positions set
        quantity = v_new_qty,
        avg_cost = v_new_avg,
        last_price = v_fill_price,
        market_value = v_new_qty * v_fill_price,
        unrealized_pnl = (v_fill_price - v_new_avg) * v_new_qty,
        updated_at = now()
      where id = v_position.id;
    else
      insert into public.moneyhub_paper_positions(
        owner_id,run_id,strategy_id,symbol,asset_class,quantity,avg_cost,last_price,market_value,unrealized_pnl
      ) values(
        p_owner_id,v_order.run_id,v_order.strategy_id,v_order.symbol,v_order.asset_class,
        v_order.quantity,v_fill_price,v_fill_price,v_fill_value,0
      );
    end if;
    v_cash := v_cash - v_fill_value - coalesce(p_fee,0);
  else
    if not found or v_position.quantity < v_order.quantity then
      raise exception 'paper engine is long-only; insufficient position to sell';
    end if;
    if v_position.owner_id <> p_owner_id or v_position.strategy_id <> v_order.strategy_id then
      raise exception 'paper position ownership or strategy mismatch';
    end if;
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
  values(p_owner_id,p_order_id,v_order.quantity,v_fill_price,coalesce(p_fee,0),coalesce(p_slippage_bps,0))
  returning id into v_fill_id;

  update public.moneyhub_paper_orders
  set status='filled', filled_at=now()
  where id=p_order_id and owner_id=p_owner_id;

  update public.moneyhub_paper_runs set
    status = case when status='pending' then 'running' else status end,
    started_at = coalesce(started_at, now()),
    ending_cash = v_cash,
    realized_pnl = realized_pnl + v_realized
  where id=v_order.run_id and owner_id=p_owner_id;

  return jsonb_build_object(
    'fill_id',v_fill_id,
    'fill_price',v_fill_price,
    'cash',v_cash,
    'realized_pnl',v_realized,
    'mode','simulation_only'
  );
end;
$$;

revoke all on function public.moneyhub_paper_execute_order(uuid,uuid,numeric,numeric,numeric)
  from public, anon, authenticated;
grant execute on function public.moneyhub_paper_execute_order(uuid,uuid,numeric,numeric,numeric)
  to service_role;

commit;
