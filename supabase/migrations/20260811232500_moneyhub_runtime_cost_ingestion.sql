-- MoneyHub idempotent runtime-cost ingestion from Hermes.
-- Hermes remains the operational source; MoneyHub records financial attribution exactly once per run.

begin;

create table if not exists public.moneyhub_runtime_cost_ingestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_system text not null default 'hermes',
  source_ref text not null,
  agent_name text not null,
  amount numeric(24,8) not null check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3,12}$'),
  tokens_used bigint,
  duration_ms bigint,
  attribution_event_id uuid not null references public.moneyhub_attribution_events(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  unique(owner_id, source_system, source_ref)
);

create index if not exists moneyhub_runtime_cost_owner_time_idx
  on public.moneyhub_runtime_cost_ingestions(owner_id, ingested_at desc);
create index if not exists moneyhub_runtime_cost_agent_idx
  on public.moneyhub_runtime_cost_ingestions(owner_id, agent_name, ingested_at desc);

alter table public.moneyhub_runtime_cost_ingestions enable row level security;
grant all on public.moneyhub_runtime_cost_ingestions to service_role;
grant select on public.moneyhub_runtime_cost_ingestions to authenticated;

drop policy if exists moneyhub_runtime_cost_owner_read on public.moneyhub_runtime_cost_ingestions;
create policy moneyhub_runtime_cost_owner_read
  on public.moneyhub_runtime_cost_ingestions for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.moneyhub_ingest_runtime_cost(
  p_owner_id uuid,
  p_source_system text,
  p_source_ref text,
  p_agent_name text,
  p_amount numeric,
  p_currency text default 'USD',
  p_tokens_used bigint default null,
  p_duration_ms bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.moneyhub_runtime_cost_ingestions%rowtype;
  v_event_id uuid;
  v_ingestion_id uuid;
  v_source_system text := lower(coalesce(nullif(btrim(p_source_system),''),'hermes'));
  v_source_ref text := nullif(btrim(p_source_ref),'');
  v_agent_name text := nullif(btrim(p_agent_name),'');
  v_currency text := upper(coalesce(nullif(btrim(p_currency),''),'USD'));
begin
  if p_owner_id is null then raise exception 'owner is required'; end if;
  if v_source_ref is null then raise exception 'source_ref is required'; end if;
  if v_agent_name is null then raise exception 'agent_name is required'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'amount must be >= 0'; end if;
  if v_currency !~ '^[A-Z]{3,12}$' then raise exception 'invalid currency'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':' || v_source_system || ':' || v_source_ref, 0));

  select * into v_existing
  from public.moneyhub_runtime_cost_ingestions
  where owner_id=p_owner_id and source_system=v_source_system and source_ref=v_source_ref;

  if found then
    return jsonb_build_object(
      'ingestion_id',v_existing.id,
      'attribution_event_id',v_existing.attribution_event_id,
      'created',false,
      'mode','financial_attribution'
    );
  end if;

  insert into public.moneyhub_attribution_events(
    owner_id,event_type,amount,currency,agent_name,source_type,source_ref,occurred_at,metadata
  ) values (
    p_owner_id,'model_cost',p_amount,v_currency,v_agent_name,v_source_system,v_source_ref,now(),
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('tokens_used',p_tokens_used,'duration_ms',p_duration_ms)
  ) returning id into v_event_id;

  insert into public.moneyhub_runtime_cost_ingestions(
    owner_id,source_system,source_ref,agent_name,amount,currency,tokens_used,duration_ms,attribution_event_id,metadata
  ) values (
    p_owner_id,v_source_system,v_source_ref,v_agent_name,p_amount,v_currency,p_tokens_used,p_duration_ms,v_event_id,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_ingestion_id;

  return jsonb_build_object(
    'ingestion_id',v_ingestion_id,
    'attribution_event_id',v_event_id,
    'created',true,
    'mode','financial_attribution'
  );
end;
$$;

revoke all on function public.moneyhub_ingest_runtime_cost(uuid,text,text,text,numeric,text,bigint,bigint,jsonb)
  from public,anon,authenticated;
grant execute on function public.moneyhub_ingest_runtime_cost(uuid,text,text,text,numeric,text,bigint,bigint,jsonb)
  to service_role;

commit;
