-- Enforce ordered simulation stages at the database boundary.

begin;

create or replace function public.moneyhub_guard_paper_run_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_stage text;
begin
  select promotion_stage into v_stage
  from public.moneyhub_paper_strategies
  where id=new.strategy_id and owner_id=new.owner_id
  for update;

  if not found then raise exception 'strategy not found for run'; end if;

  if new.run_type='backtest' then
    if v_stage not in ('draft','backtest') then
      raise exception 'backtest run not permitted from promotion stage %', v_stage;
    end if;
    update public.moneyhub_paper_strategies
      set promotion_stage='backtest', status='backtest', updated_at=now()
      where id=new.strategy_id and owner_id=new.owner_id;
  elsif new.run_type='walk_forward' then
    if v_stage <> 'walk_forward' then
      raise exception 'walk-forward run requires walk_forward promotion stage';
    end if;
  elsif new.run_type='paper' then
    if v_stage <> 'paper' then
      raise exception 'paper run requires paper promotion stage';
    end if;
  elsif new.run_type='shadow' then
    if v_stage <> 'shadow' then
      raise exception 'shadow run requires shadow promotion stage';
    end if;
  else
    raise exception 'unsupported simulation run type';
  end if;

  return new;
end;
$$;

revoke all on function public.moneyhub_guard_paper_run_stage() from public,anon,authenticated;
grant execute on function public.moneyhub_guard_paper_run_stage() to service_role;

drop trigger if exists moneyhub_paper_runs_stage_guard on public.moneyhub_paper_runs;
create trigger moneyhub_paper_runs_stage_guard
before insert on public.moneyhub_paper_runs
for each row execute function public.moneyhub_guard_paper_run_stage();

commit;
