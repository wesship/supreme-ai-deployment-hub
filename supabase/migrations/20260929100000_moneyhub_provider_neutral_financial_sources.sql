-- MoneyHub provider-neutral financial source contract.
-- Additive storage only. No browser mutation and no provider-side execution.

create table if not exists public.moneyhub_financial_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('bank','payment','accounting','brokerage','manual')),
  provider text not null,
  external_connection_id text,
  status text not null default 'active' check (status in ('active','paused','error','revoked')),
  last_cursor text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moneyhub_financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.moneyhub_financial_sources(id) on delete cascade,
  provider_account_id text not null,
  account_name text,
  account_type text not null check (account_type in ('checking','savings','credit','loan','brokerage','payment','other')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  current_balance numeric(18,2),
  available_balance numeric(18,2),
  balance_observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, provider_account_id),
  unique(id, user_id)
);

create table if not exists public.moneyhub_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  provider text not null,
  provider_transaction_id text not null,
  idempotency_key text not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('inflow','outflow')),
  status text not null check (status in ('pending','posted')),
  occurred_at timestamptz not null,
  posted_at timestamptz,
  description text,
  merchant text,
  category text,
  is_transfer boolean not null default false,
  transfer_group_id text,
  confidence text not null default 'high' check (confidence in ('high','medium','low')),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moneyhub_financial_transactions_account_owner_fk
    foreign key (account_id, user_id)
    references public.moneyhub_financial_accounts(id, user_id)
    on delete cascade,
  unique(user_id, idempotency_key)
);

create index if not exists idx_moneyhub_financial_sources_user on public.moneyhub_financial_sources(user_id);
create index if not exists idx_moneyhub_financial_accounts_user on public.moneyhub_financial_accounts(user_id);
create index if not exists idx_moneyhub_financial_transactions_user_occurred on public.moneyhub_financial_transactions(user_id, occurred_at desc);
create index if not exists idx_moneyhub_financial_transactions_account on public.moneyhub_financial_transactions(account_id, occurred_at desc);

alter table public.moneyhub_financial_sources enable row level security;
alter table public.moneyhub_financial_accounts enable row level security;
alter table public.moneyhub_financial_transactions enable row level security;

drop policy if exists moneyhub_financial_sources_owner_read on public.moneyhub_financial_sources;
create policy moneyhub_financial_sources_owner_read on public.moneyhub_financial_sources
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists moneyhub_financial_accounts_owner_read on public.moneyhub_financial_accounts;
create policy moneyhub_financial_accounts_owner_read on public.moneyhub_financial_accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists moneyhub_financial_transactions_owner_read on public.moneyhub_financial_transactions;
create policy moneyhub_financial_transactions_owner_read on public.moneyhub_financial_transactions
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.moneyhub_financial_sources from anon, authenticated;
revoke insert, update, delete on public.moneyhub_financial_accounts from anon, authenticated;
revoke insert, update, delete on public.moneyhub_financial_transactions from anon, authenticated;

grant select on public.moneyhub_financial_sources to authenticated;
grant select on public.moneyhub_financial_accounts to authenticated;
grant select on public.moneyhub_financial_transactions to authenticated;

comment on table public.moneyhub_financial_sources is 'Provider-neutral source registry. Connection and sync mutation stays backend-controlled.';
comment on table public.moneyhub_financial_accounts is 'Normalized financial accounts. Balances are observations, not custody.';
comment on table public.moneyhub_financial_transactions is 'Normalized provider transactions. No transfer or payment execution is implied.';
