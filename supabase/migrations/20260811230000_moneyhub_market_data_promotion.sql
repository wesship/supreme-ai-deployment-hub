-- MoneyHub governed simulation market data + strategy promotion engine.
-- This migration remains simulation/shadow-only; it does not add broker execution.

begin;

create table if not exists public.moneyhub_market_quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  trust_tier text not null default 'manual_simulation',
  symbol text not null,
  asset_class text not null,
  price numeric(24,8) not null check (price > 0),
  bid numeric(24,8),
  ask numeric(24,8),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_ref text,
  metadata jsonb not null default '{}'::jsonb,
  constraint moneyhub_market_quote_asset_check check (asset_class in ('equity','etf','crypto','fx','option','rwa','cash','other')),
  constraint moneyhub_market_quote_trust_check check (trust_tier in ('manual_simulation','provider_simulation','verified_provider')),
  constraint moneyhub_market_quote_spread_check check (
    (bid is null or bid > 0) and (ask is null or ask > 0) and (bid is null or ask is null or ask >= bid)
  )
);

create index if not exists moneyhub_market_quotes_owner_symbol_idx
  on public.moneyhub_market_quotes(owner_id, symbol, observed_at desc);
create index if not exists moneyhub_market_quotes_provider_idx
  on public.moneyhub_market_quotes(owner_id, provider, observed_at desc);

alter table public.moneyhub_market_quotes enable row level security;
grant all on public.moneyhub_market_quotes to service_role;
grant select on public.moneyhub_market_quotes to authenticated;

drop policy if exists moneyhub_market_quotes_owner_read on public.moneyhub_market_quotes;
create policy moneyhub_market_quotes_owner_read
  on public.moneyhub_market_quotes for select to authenticated
  using (owner_id = (select auth.uid()));

create table if not exists public.moneyhub_promotion_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  min_snapshots integer not null default 20 check (min_snapshots >= 1),
  min_trades integer not null default 10 check (min_trades >= 0),
  min_return_pct numeric(18,8) not null default 0,
  max_drawdown_pct numeric(18,8) not null default 10 check (max_drawdown_pct >= 0 and max_drawdown_pct <= 100),
  min_score numeric(18,8) not null default 0,
  require_completed_run boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, from_stage, to_stage),
  constraint moneyhub_promotion_policy_from_check check (from_stage in ('backtest','walk_forward','paper')),
  constraint moneyhub_promotion_policy_to_check check (to_stage in ('walk_forward','paper','shadow')),
  constraint moneyhub_promotion_policy_transition_check check (
    (from_stage='backtest' and to_stage='walk_forward') or
    (from_stage='walk_forward' and to_stage='paper') or
    (from_stage='paper' and to_stage='shadow')
  )
);

alter table public.moneyhub_paper_strategies
  add column if not exists promotion_stage text not null default 'draft';

alter table public.moneyhub_paper_strategies
  drop constraint if exists moneyhub_paper_strategy_promotion_stage_check;
alter table public.moneyhub_paper_strategies
  add constraint moneyhub_paper_strategy_promotion_stage_check
  check (promotion_stage in ('draft','backtest','walk_forward','paper','shadow'));

create table if not exists public.moneyhub_promotion_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.moneyhub_paper_strategies(id) on delete cascade,
  run_id uuid not null references public.moneyhub_paper_runs(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  decision text not null,
  reasons jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  policy_snapshot jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  constraint moneyhub_promotion_decision_check check (decision in ('promoted','held','rejected'))
);

create index if not exists moneyhub_promotion_eval_strategy_idx
  on public.moneyhub_promotion_evaluations(owner_id, strategy_id, evaluated_at desc);

do $$
declare t text;
begin
  foreach t in array array['moneyhub_promotion_policies','moneyhub_promotion_evaluations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists moneyhub_promotion_policies_owner_read on public.moneyhub_promotion_policies;
create policy moneyhub_promotion_policies_owner_read
  on public.moneyhub_promotion_policies for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists moneyhub_promotion_evaluations_owner_read on public.moneyhub_promotion_evaluations;
create policy moneyhub_promotion_evaluations_owner_read
  on public.moneyhub_promotion_evaluations for select to authenticated
  using (owner_id = (select auth.uid()));

drop trigger if exists moneyhub_promotion_policies_set_updated_at on public.moneyhub_promotion_policies;
create trigger moneyhub_promotion_policies_set_updated_at
before update on public.moneyhub_promotion_policies
for each row execute function public.moneyhub_set_updated_at();

create or replace function public.moneyhub_ingest_market_quotes(
  p_owner_id uuid,
  p_provider text,
  p_trust_tier text,
  p_quotes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote jsonb;
  v_count integer := 0;
  v_symbol text;
  v_asset text;
  v_price numeric(24,8);
  v_bid numeric(24,8);
  v_ask numeric(24,8);
  v_observed_at timestamptz;
begin
  if p_owner_id is null then raise exception 'owner is required'; end if;
  if nullif(btrim(p_provider),'') is null then raise exception 'provider is required'; end if;
  if p_trust_tier not in ('manual_simulation','provider_simulation','verified_provider') then
    raise exception 'invalid trust tier';
  end if;
  if jsonb_typeof(p_quotes) <> 'array' or jsonb_array_length(p_quotes) = 0 then
    raise exception 'quotes must be a non-empty JSON array';
  end if;

  for v_quote in select value from jsonb_array_elements(p_quotes)
  loop
    v_symbol := upper(nullif(btrim(v_quote->>'symbol'),''));
    v_asset := coalesce(nullif(btrim(v_quote->>'asset_class'),''),'other');
    v_price := nullif(v_quote->>'price','')::numeric(24,8);
    v_bid := nullif(v_quote->>'bid','')::numeric(24,8);
    v_ask := nullif(v_quote->>'ask','')::numeric(24,8);
    v_observed_at := coalesce(nullif(v_quote->>'observed_at','')::timestamptz, now());

    if v_symbol is null or v_price is null or v_price <= 0 then
      raise exception 'each quote requires symbol and price > 0';
    end if;
    if v_asset not in ('equity','etf','crypto','fx','option','rwa','cash','other') then
      raise exception 'invalid asset class for %', v_symbol;
    end if;
    if v_bid is not null and v_bid <= 0 then raise exception 'bid must be > 0'; end if;
    if v_ask is not null and v_ask <= 0 then raise exception 'ask must be > 0'; end if;
    if v_bid is not null and v_ask is not null and v_ask < v_bid then raise exception 'ask must be >= bid'; end if;
    if v_observed_at > now() + interval '5 minutes' then raise exception 'quote observed_at is too far in the future'; end if;

    insert into public.moneyhub_market_quotes(
      owner_id,provider,trust_tier,symbol,asset_class,price,bid,ask,observed_at,source_ref,metadata
    ) values (
      p_owner_id,p_provider,p_trust_tier,v_symbol,v_asset,v_price,v_bid,v_ask,v_observed_at,
      v_quote->>'source_ref',coalesce(v_quote->'metadata','{}'::jsonb)
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ingested',v_count,'provider',p_provider,'trust_tier',p_trust_tier,'mode','simulation_only');
end;
$$;

create or replace function public.moneyhub_evaluate_strategy_promotion(
  p_owner_id uuid,
  p_strategy_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_strategy public.moneyhub_paper_strategies%rowtype;
  v_run public.moneyhub_paper_runs%rowtype;
  v_from text;
  v_to text;
  v_expected_stage text;
  v_policy public.moneyhub_promotion_policies%rowtype;
  v_snapshot_count integer;
  v_trade_count integer;
  v_return numeric(18,8);
  v_drawdown numeric(18,8);
  v_score numeric(18,8);
  v_reasons jsonb := '[]'::jsonb;
  v_promote boolean := true;
  v_eval_id uuid;
begin
  select * into v_strategy from public.moneyhub_paper_strategies
  where id=p_strategy_id and owner_id=p_owner_id for update;
  if not found then raise exception 'strategy not found'; end if;

  select * into v_run from public.moneyhub_paper_runs
  where id=p_run_id and strategy_id=p_strategy_id and owner_id=p_owner_id;
  if not found then raise exception 'run not found for strategy'; end if;

  v_from := case
    when v_run.run_type='backtest' then 'backtest'
    when v_run.run_type='walk_forward' then 'walk_forward'
    when v_run.run_type='paper' then 'paper'
    else null
  end;
  if v_from is null then raise exception 'shadow runs are terminal for automatic promotion'; end if;
  v_to := case v_from when 'backtest' then 'walk_forward' when 'walk_forward' then 'paper' when 'paper' then 'shadow' end;
  v_expected_stage := case when v_from='backtest' then 'backtest' else v_from end;

  if v_strategy.promotion_stage <> v_expected_stage then
    raise exception 'strategy promotion stage % does not permit evaluation of % run', v_strategy.promotion_stage, v_from;
  end if;

  select * into v_policy from public.moneyhub_promotion_policies
  where owner_id=p_owner_id and from_stage=v_from and to_stage=v_to and active=true;

  if not found then
    v_policy.owner_id := p_owner_id;
    v_policy.from_stage := v_from;
    v_policy.to_stage := v_to;
    v_policy.min_snapshots := case when v_from='paper' then 50 else 20 end;
    v_policy.min_trades := case when v_from='paper' then 20 else 10 end;
    v_policy.min_return_pct := 0;
    v_policy.max_drawdown_pct := case when v_from='backtest' then 10 when v_from='walk_forward' then 8 else 6 end;
    v_policy.min_score := 0;
    v_policy.require_completed_run := true;
  end if;

  select count(*),
         coalesce((array_agg(return_pct order by measured_at desc))[1],0),
         coalesce(max(drawdown_pct),0),
         coalesce((array_agg(score order by measured_at desc))[1],0)
  into v_snapshot_count,v_return,v_drawdown,v_score
  from public.moneyhub_paper_performance
  where owner_id=p_owner_id and run_id=p_run_id;

  select count(*) into v_trade_count from public.moneyhub_paper_fills f
  join public.moneyhub_paper_orders o on o.id=f.order_id
  where f.owner_id=p_owner_id and o.run_id=p_run_id;

  if v_policy.require_completed_run and v_run.status <> 'completed' then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array('run must be completed');
  end if;
  if v_snapshot_count < v_policy.min_snapshots then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array(format('requires at least %s performance snapshots',v_policy.min_snapshots));
  end if;
  if v_trade_count < v_policy.min_trades then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array(format('requires at least %s fills',v_policy.min_trades));
  end if;
  if v_return < v_policy.min_return_pct then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array('return threshold not met');
  end if;
  if v_drawdown > v_policy.max_drawdown_pct then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array('maximum drawdown exceeded');
  end if;
  if v_score < v_policy.min_score then
    v_promote := false; v_reasons := v_reasons || jsonb_build_array('minimum score not met');
  end if;

  insert into public.moneyhub_promotion_evaluations(
    owner_id,strategy_id,run_id,from_stage,to_stage,decision,reasons,metrics,policy_snapshot
  ) values (
    p_owner_id,p_strategy_id,p_run_id,v_from,v_to,
    case when v_promote then 'promoted' else 'held' end,
    v_reasons,
    jsonb_build_object('snapshot_count',v_snapshot_count,'trade_count',v_trade_count,'return_pct',v_return,'max_drawdown_pct',v_drawdown,'score',v_score),
    jsonb_build_object('min_snapshots',v_policy.min_snapshots,'min_trades',v_policy.min_trades,'min_return_pct',v_policy.min_return_pct,'max_drawdown_pct',v_policy.max_drawdown_pct,'min_score',v_policy.min_score,'require_completed_run',v_policy.require_completed_run)
  ) returning id into v_eval_id;

  if v_promote then
    update public.moneyhub_paper_strategies
      set promotion_stage=v_to,
          status=case when v_to='walk_forward' then 'validated' when v_to in ('paper','shadow') then 'paper' else status end,
          updated_at=now()
    where id=p_strategy_id and owner_id=p_owner_id;
  end if;

  return jsonb_build_object(
    'evaluation_id',v_eval_id,'decision',case when v_promote then 'promoted' else 'held' end,
    'from_stage',v_from,'to_stage',v_to,'reasons',v_reasons,
    'metrics',jsonb_build_object('snapshot_count',v_snapshot_count,'trade_count',v_trade_count,'return_pct',v_return,'max_drawdown_pct',v_drawdown,'score',v_score),
    'mode','simulation_only'
  );
end;
$$;

revoke all on function public.moneyhub_ingest_market_quotes(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.moneyhub_evaluate_strategy_promotion(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.moneyhub_ingest_market_quotes(uuid,text,text,jsonb) to service_role;
grant execute on function public.moneyhub_evaluate_strategy_promotion(uuid,uuid,uuid) to service_role;

commit;
