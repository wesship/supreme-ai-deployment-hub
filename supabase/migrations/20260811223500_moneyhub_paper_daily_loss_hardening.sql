-- MoneyHub paper monitoring hardening
-- Daily-loss circuits must use today's simulated NAV loss, not lifetime realized P&L.

begin;

create or replace function public.moneyhub_paper_snapshot(
  p_owner_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.moneyhub_paper_runs%rowtype;
  v_strategy public.moneyhub_paper_strategies%rowtype;
  v_cash numeric(24,8);
  v_exposure numeric(24,8);
  v_unrealized numeric(24,8);
  v_realized numeric(24,8);
  v_nav numeric(24,8);
  v_return_pct numeric(18,8);
  v_peak numeric(24,8);
  v_drawdown numeric(18,8);
  v_daily_start_nav numeric(24,8);
  v_daily_loss numeric(24,8);
  v_trade_count integer;
  v_win_count integer;
  v_win_rate numeric(18,8);
  v_score numeric(18,8);
  v_limit record;
  v_pause_reason text := null;
  v_event_type text := null;
  v_snapshot_id uuid;
begin
  select * into v_run
  from public.moneyhub_paper_runs
  where id=p_run_id and owner_id=p_owner_id
  for update;
  if not found then raise exception 'paper run not found'; end if;

  select * into v_strategy
  from public.moneyhub_paper_strategies
  where id=v_run.strategy_id and owner_id=p_owner_id;
  if not found then raise exception 'paper strategy not found'; end if;

  v_cash := coalesce(v_run.ending_cash,v_run.starting_cash);
  select coalesce(sum(market_value),0),coalesce(sum(unrealized_pnl),0),coalesce(sum(realized_pnl),0)
  into v_exposure,v_unrealized,v_realized
  from public.moneyhub_paper_positions
  where owner_id=p_owner_id and run_id=p_run_id;

  v_realized := greatest(v_realized, v_run.realized_pnl);
  v_nav := v_cash + v_exposure;
  v_return_pct := case when v_run.starting_cash=0 then 0 else ((v_nav-v_run.starting_cash)/v_run.starting_cash)*100 end;

  select greatest(coalesce(max(nav),v_run.starting_cash),v_run.starting_cash)
  into v_peak
  from public.moneyhub_paper_performance
  where owner_id=p_owner_id and run_id=p_run_id;
  v_drawdown := case when v_peak<=0 then 0 else greatest(((v_peak-v_nav)/v_peak)*100,0) end;

  -- First NAV snapshot for the current UTC day is the daily loss baseline.
  -- If no snapshot exists yet today, use the current NAV so the first snapshot
  -- cannot manufacture a historical daily loss.
  select nav into v_daily_start_nav
  from public.moneyhub_paper_performance
  where owner_id=p_owner_id
    and run_id=p_run_id
    and measured_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  order by measured_at asc, id asc
  limit 1;
  v_daily_start_nav := coalesce(v_daily_start_nav, v_nav);
  v_daily_loss := greatest(v_daily_start_nav - v_nav, 0);

  select count(*),count(*) filter(where p.realized_pnl>0)
  into v_trade_count,v_win_count
  from public.moneyhub_paper_positions p
  where p.owner_id=p_owner_id and p.run_id=p_run_id and p.realized_pnl<>0;
  v_win_rate := case when v_trade_count=0 then null else (v_win_count::numeric/v_trade_count::numeric)*100 end;
  v_score := v_return_pct - (v_drawdown*1.5);

  insert into public.moneyhub_paper_performance(
    owner_id,run_id,strategy_id,nav,cash,gross_exposure,realized_pnl,
    unrealized_pnl,return_pct,drawdown_pct,win_rate,trade_count,score,metadata
  ) values(
    p_owner_id,p_run_id,v_run.strategy_id,v_nav,v_cash,v_exposure,v_realized,
    v_unrealized,v_return_pct,v_drawdown,v_win_rate,v_trade_count,v_score,
    jsonb_build_object('daily_start_nav',v_daily_start_nav,'daily_loss',v_daily_loss)
  ) returning id into v_snapshot_id;

  update public.moneyhub_paper_runs set
    unrealized_pnl=v_unrealized,
    realized_pnl=v_realized,
    max_drawdown_pct=greatest(coalesce(max_drawdown_pct,0),v_drawdown),
    ending_cash=v_cash
  where id=p_run_id;

  for v_limit in
    select * from public.moneyhub_risk_limits
    where owner_id=p_owner_id and active=true and currency=v_strategy.base_currency
      and ((scope_type='global' and scope_key='global') or (scope_type='strategy' and scope_key=v_run.strategy_id::text))
  loop
    if v_limit.kill_switch then
      v_pause_reason := 'kill switch enabled for '||v_limit.scope_type||':'||v_limit.scope_key;
      v_event_type := 'kill_switch';
      exit;
    elsif v_limit.max_drawdown_pct is not null and v_drawdown >= v_limit.max_drawdown_pct then
      v_pause_reason := 'drawdown limit reached for '||v_limit.scope_type||':'||v_limit.scope_key;
      v_event_type := 'drawdown_pause';
      exit;
    elsif v_limit.daily_loss_limit is not null and v_daily_loss >= v_limit.daily_loss_limit then
      v_pause_reason := 'daily loss limit reached for '||v_limit.scope_type||':'||v_limit.scope_key;
      v_event_type := 'daily_loss_pause';
      exit;
    end if;
  end loop;

  if v_pause_reason is not null then
    update public.moneyhub_paper_runs
    set status='paused'
    where id=p_run_id and status in ('pending','running');

    update public.moneyhub_paper_strategies
    set status='paused'
    where id=v_run.strategy_id and status <> 'retired';

    insert into public.moneyhub_paper_circuit_events(
      owner_id,run_id,strategy_id,event_type,reason,severity,snapshot
    ) values(
      p_owner_id,p_run_id,v_run.strategy_id,v_event_type,v_pause_reason,'critical',
      jsonb_build_object(
        'nav',v_nav,'return_pct',v_return_pct,'drawdown_pct',v_drawdown,
        'realized_pnl',v_realized,'daily_start_nav',v_daily_start_nav,'daily_loss',v_daily_loss
      )
    );
  end if;

  return jsonb_build_object(
    'snapshot_id',v_snapshot_id,'nav',v_nav,'cash',v_cash,'gross_exposure',v_exposure,
    'realized_pnl',v_realized,'unrealized_pnl',v_unrealized,'return_pct',v_return_pct,
    'drawdown_pct',v_drawdown,'daily_start_nav',v_daily_start_nav,'daily_loss',v_daily_loss,
    'score',v_score,'paused',v_pause_reason is not null,'pause_reason',v_pause_reason,
    'mode','simulation_only'
  );
end;
$$;

revoke all on function public.moneyhub_paper_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.moneyhub_paper_snapshot(uuid,uuid) to service_role;

commit;
