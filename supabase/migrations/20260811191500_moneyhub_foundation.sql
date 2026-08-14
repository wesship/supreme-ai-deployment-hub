-- D3VONN.IO MoneyHub foundation
-- Governed, backend-written double-entry accounting primitives for the capital control plane.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core accounts and journal ledger
-- ---------------------------------------------------------------------------

create table if not exists public.moneyhub_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null,
  normal_balance text not null,
  currency text not null default 'USD',
  agent_name text,
  business_unit text,
  external_ref text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code),
  constraint moneyhub_accounts_type_check check (
    account_type in ('asset','liability','equity','revenue','expense')
  ),
  constraint moneyhub_accounts_normal_balance_check check (
    normal_balance in ('debit','credit')
  ),
  constraint moneyhub_accounts_currency_check check (
    currency ~ '^[A-Z]{3,12}$'
  )
);

create table if not exists public.moneyhub_journals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'posted',
  currency text not null default 'USD',
  description text not null,
  source_type text not null default 'system',
  source_ref text,
  agent_name text,
  correlation_id text,
  occurred_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  reversed_journal_id uuid references public.moneyhub_journals(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key),
  constraint moneyhub_journals_status_check check (
    status in ('posted','reversed')
  ),
  constraint moneyhub_journals_currency_check check (
    currency ~ '^[A-Z]{3,12}$'
  )
);

create table if not exists public.moneyhub_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.moneyhub_journals(id) on delete restrict,
  account_id uuid not null references public.moneyhub_accounts(id) on delete restrict,
  direction text not null,
  amount numeric(24,8) not null,
  memo text,
  agent_name text,
  project_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moneyhub_entries_direction_check check (direction in ('debit','credit')),
  constraint moneyhub_entries_amount_check check (amount > 0)
);

create index if not exists moneyhub_accounts_owner_idx
  on public.moneyhub_accounts(owner_id, active);
create index if not exists moneyhub_accounts_agent_idx
  on public.moneyhub_accounts(owner_id, agent_name)
  where agent_name is not null;
create index if not exists moneyhub_journals_owner_occurred_idx
  on public.moneyhub_journals(owner_id, occurred_at desc);
create index if not exists moneyhub_journals_source_idx
  on public.moneyhub_journals(owner_id, source_type, source_ref)
  where source_ref is not null;
create index if not exists moneyhub_entries_journal_idx
  on public.moneyhub_entries(journal_id);
create index if not exists moneyhub_entries_account_idx
  on public.moneyhub_entries(account_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Agent budgets and capital-risk controls
-- ---------------------------------------------------------------------------

create table if not exists public.moneyhub_agent_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null,
  currency text not null default 'USD',
  per_transaction_limit numeric(24,8),
  daily_limit numeric(24,8),
  monthly_limit numeric(24,8),
  requires_approval_over numeric(24,8),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, agent_name, currency),
  constraint moneyhub_agent_budgets_nonnegative_check check (
    coalesce(per_transaction_limit, 0) >= 0 and
    coalesce(daily_limit, 0) >= 0 and
    coalesce(monthly_limit, 0) >= 0 and
    coalesce(requires_approval_over, 0) >= 0
  )
);

create table if not exists public.moneyhub_risk_limits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null default 'global',
  scope_key text not null default 'global',
  currency text not null default 'USD',
  max_position_value numeric(24,8),
  max_order_value numeric(24,8),
  daily_loss_limit numeric(24,8),
  max_drawdown_pct numeric(9,6),
  requires_approval_over numeric(24,8),
  kill_switch boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, scope_type, scope_key, currency),
  constraint moneyhub_risk_scope_check check (
    scope_type in ('global','agent','strategy','account','asset','business_unit')
  ),
  constraint moneyhub_risk_drawdown_check check (
    max_drawdown_pct is null or (max_drawdown_pct >= 0 and max_drawdown_pct <= 100)
  ),
  constraint moneyhub_risk_nonnegative_check check (
    coalesce(max_position_value, 0) >= 0 and
    coalesce(max_order_value, 0) >= 0 and
    coalesce(daily_loss_limit, 0) >= 0 and
    coalesce(requires_approval_over, 0) >= 0
  )
);

-- ---------------------------------------------------------------------------
-- Updated-at and immutability controls
-- ---------------------------------------------------------------------------

create or replace function public.moneyhub_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.moneyhub_prevent_posted_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'MoneyHub posted ledger records are immutable; create a reversing journal instead';
end;
$$;

drop trigger if exists moneyhub_accounts_set_updated_at on public.moneyhub_accounts;
create trigger moneyhub_accounts_set_updated_at
before update on public.moneyhub_accounts
for each row execute function public.moneyhub_set_updated_at();

drop trigger if exists moneyhub_agent_budgets_set_updated_at on public.moneyhub_agent_budgets;
create trigger moneyhub_agent_budgets_set_updated_at
before update on public.moneyhub_agent_budgets
for each row execute function public.moneyhub_set_updated_at();

drop trigger if exists moneyhub_risk_limits_set_updated_at on public.moneyhub_risk_limits;
create trigger moneyhub_risk_limits_set_updated_at
before update on public.moneyhub_risk_limits
for each row execute function public.moneyhub_set_updated_at();

drop trigger if exists moneyhub_journals_immutable on public.moneyhub_journals;
create trigger moneyhub_journals_immutable
before update or delete on public.moneyhub_journals
for each row execute function public.moneyhub_prevent_posted_mutation();

drop trigger if exists moneyhub_entries_immutable on public.moneyhub_entries;
create trigger moneyhub_entries_immutable
before update or delete on public.moneyhub_entries
for each row execute function public.moneyhub_prevent_posted_mutation();

-- ---------------------------------------------------------------------------
-- Atomic governed posting RPC
-- Service-role only. User identity is explicit so backend services cannot rely
-- on mutable client-supplied auth claims when establishing ledger ownership.
-- ---------------------------------------------------------------------------

create or replace function public.moneyhub_post_journal(
  p_owner_id uuid,
  p_idempotency_key text,
  p_description text,
  p_currency text,
  p_entries jsonb,
  p_source_type text default 'system',
  p_source_ref text default null,
  p_agent_name text default null,
  p_correlation_id text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal_id uuid;
  v_entry jsonb;
  v_account_id uuid;
  v_direction text;
  v_amount numeric(24,8);
  v_debits numeric(24,8) := 0;
  v_credits numeric(24,8) := 0;
  v_account_owner uuid;
  v_account_currency text;
  v_account_active boolean;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key is required';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception 'description is required';
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3,12}$' then
    raise exception 'invalid currency code';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'a journal requires at least two entries';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_owner_id::text || ':' || p_idempotency_key));

  select id into v_journal_id
  from public.moneyhub_journals
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;

  if v_journal_id is not null then
    return v_journal_id;
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    begin
      v_account_id := (v_entry ->> 'account_id')::uuid;
      v_direction := lower(v_entry ->> 'direction');
      v_amount := (v_entry ->> 'amount')::numeric(24,8);
    exception when others then
      raise exception 'invalid MoneyHub entry payload';
    end;

    if v_direction not in ('debit','credit') or v_amount is null or v_amount <= 0 then
      raise exception 'each entry requires direction debit/credit and amount > 0';
    end if;

    select owner_id, currency, active
      into v_account_owner, v_account_currency, v_account_active
    from public.moneyhub_accounts
    where id = v_account_id;

    if not found then
      raise exception 'MoneyHub account % does not exist', v_account_id;
    end if;
    if v_account_owner <> p_owner_id then
      raise exception 'cross-owner journal entries are prohibited';
    end if;
    if not v_account_active then
      raise exception 'MoneyHub account % is inactive', v_account_id;
    end if;
    if v_account_currency <> p_currency then
      raise exception 'journal and account currency must match';
    end if;

    if v_direction = 'debit' then
      v_debits := v_debits + v_amount;
    else
      v_credits := v_credits + v_amount;
    end if;
  end loop;

  if v_debits <> v_credits then
    raise exception 'unbalanced journal: debits % do not equal credits %', v_debits, v_credits;
  end if;

  insert into public.moneyhub_journals (
    owner_id, idempotency_key, status, currency, description,
    source_type, source_ref, agent_name, correlation_id, occurred_at, metadata
  ) values (
    p_owner_id, p_idempotency_key, 'posted', p_currency, p_description,
    coalesce(nullif(p_source_type, ''), 'system'), p_source_ref, p_agent_name,
    p_correlation_id, coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    insert into public.moneyhub_entries (
      journal_id, account_id, direction, amount, memo, agent_name, project_ref, metadata
    ) values (
      v_journal_id,
      (v_entry ->> 'account_id')::uuid,
      lower(v_entry ->> 'direction'),
      (v_entry ->> 'amount')::numeric(24,8),
      v_entry ->> 'memo',
      coalesce(v_entry ->> 'agent_name', p_agent_name),
      v_entry ->> 'project_ref',
      coalesce(v_entry -> 'metadata', '{}'::jsonb)
    );
  end loop;

  return v_journal_id;
end;
$$;

-- Reversals never alter an existing journal. They create the exact opposite
-- entries and permanently link back to the original transaction.
create or replace function public.moneyhub_reverse_journal(
  p_owner_id uuid,
  p_original_journal_id uuid,
  p_idempotency_key text,
  p_description text default null,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.moneyhub_journals%rowtype;
  v_entries jsonb;
  v_reversal_id uuid;
begin
  select * into v_original
  from public.moneyhub_journals
  where id = p_original_journal_id and owner_id = p_owner_id;

  if not found then
    raise exception 'original MoneyHub journal not found';
  end if;

  select jsonb_agg(jsonb_build_object(
    'account_id', e.account_id,
    'direction', case when e.direction = 'debit' then 'credit' else 'debit' end,
    'amount', e.amount,
    'memo', concat('Reversal of ', coalesce(e.memo, v_original.description)),
    'agent_name', e.agent_name,
    'project_ref', e.project_ref,
    'metadata', e.metadata
  ) order by e.created_at, e.id)
  into v_entries
  from public.moneyhub_entries e
  where e.journal_id = p_original_journal_id;

  v_reversal_id := public.moneyhub_post_journal(
    p_owner_id,
    p_idempotency_key,
    coalesce(p_description, 'Reversal: ' || v_original.description),
    v_original.currency,
    v_entries,
    'reversal',
    p_original_journal_id::text,
    v_original.agent_name,
    p_correlation_id,
    now(),
    jsonb_build_object('reverses_journal_id', p_original_journal_id)
  );

  -- Preserve immutability of the original row: linkage is represented on the
  -- reversal journal via source_ref/metadata rather than updating the original.
  return v_reversal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read model: account balances derived only from immutable posted entries.
-- ---------------------------------------------------------------------------

create or replace view public.moneyhub_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.owner_id,
  a.code,
  a.name,
  a.account_type,
  a.normal_balance,
  a.currency,
  a.agent_name,
  coalesce(sum(
    case
      when e.direction = a.normal_balance then e.amount
      else -e.amount
    end
  ), 0)::numeric(24,8) as balance
from public.moneyhub_accounts a
left join public.moneyhub_entries e on e.account_id = a.id
left join public.moneyhub_journals j on j.id = e.journal_id and j.status = 'posted'
group by a.id, a.owner_id, a.code, a.name, a.account_type,
         a.normal_balance, a.currency, a.agent_name;

-- ---------------------------------------------------------------------------
-- RLS and least privilege
-- Authenticated users can read their own financial state. All mutation paths
-- remain backend/service-role only.
-- ---------------------------------------------------------------------------

alter table public.moneyhub_accounts enable row level security;
alter table public.moneyhub_journals enable row level security;
alter table public.moneyhub_entries enable row level security;
alter table public.moneyhub_agent_budgets enable row level security;
alter table public.moneyhub_risk_limits enable row level security;

revoke all on public.moneyhub_accounts from anon, authenticated;
revoke all on public.moneyhub_journals from anon, authenticated;
revoke all on public.moneyhub_entries from anon, authenticated;
revoke all on public.moneyhub_agent_budgets from anon, authenticated;
revoke all on public.moneyhub_risk_limits from anon, authenticated;
revoke all on public.moneyhub_account_balances from anon, authenticated;
revoke execute on function public.moneyhub_post_journal(uuid,text,text,text,jsonb,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
revoke execute on function public.moneyhub_reverse_journal(uuid,uuid,text,text,text) from public, anon, authenticated;

grant select on public.moneyhub_accounts to authenticated;
grant select on public.moneyhub_journals to authenticated;
grant select on public.moneyhub_entries to authenticated;
grant select on public.moneyhub_agent_budgets to authenticated;
grant select on public.moneyhub_risk_limits to authenticated;
grant select on public.moneyhub_account_balances to authenticated;

grant all on public.moneyhub_accounts to service_role;
grant all on public.moneyhub_journals to service_role;
grant all on public.moneyhub_entries to service_role;
grant all on public.moneyhub_agent_budgets to service_role;
grant all on public.moneyhub_risk_limits to service_role;
grant select on public.moneyhub_account_balances to service_role;
grant execute on function public.moneyhub_post_journal(uuid,text,text,text,jsonb,text,text,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.moneyhub_reverse_journal(uuid,uuid,text,text,text) to service_role;

create policy moneyhub_accounts_owner_read
  on public.moneyhub_accounts for select to authenticated
  using (owner_id = (select auth.uid()));

create policy moneyhub_journals_owner_read
  on public.moneyhub_journals for select to authenticated
  using (owner_id = (select auth.uid()));

create policy moneyhub_entries_owner_read
  on public.moneyhub_entries for select to authenticated
  using (exists (
    select 1 from public.moneyhub_journals j
    where j.id = journal_id and j.owner_id = (select auth.uid())
  ));

create policy moneyhub_agent_budgets_owner_read
  on public.moneyhub_agent_budgets for select to authenticated
  using (owner_id = (select auth.uid()));

create policy moneyhub_risk_limits_owner_read
  on public.moneyhub_risk_limits for select to authenticated
  using (owner_id = (select auth.uid()));

comment on table public.moneyhub_accounts is
  'MoneyHub chart-of-accounts. Balances are derived from immutable posted entries.';
comment on table public.moneyhub_journals is
  'MoneyHub immutable financial events with per-owner idempotency.';
comment on table public.moneyhub_entries is
  'MoneyHub double-entry debit/credit lines. Posted entries are immutable.';
comment on function public.moneyhub_post_journal(uuid,text,text,text,jsonb,text,text,text,text,timestamptz,jsonb) is
  'Backend-only atomic journal posting function enforcing ownership, currency, idempotency, and debit=credit.';

commit;
