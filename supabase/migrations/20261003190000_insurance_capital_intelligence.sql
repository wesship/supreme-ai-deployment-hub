-- Insurance Capital Intelligence: research-only data model.
-- No trade, custody, payment, or money-movement tables are created here.

create extension if not exists pgcrypto;

create type public.insurance_capital_bucket as enum ('insurer','operating_claims','trust_family_office');

create table public.insurance_capital_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bucket public.insurance_capital_bucket not null,
  jurisdiction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fixed_income_issuers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_name text not null,
  state_code text,
  issuer_type text,
  created_at timestamptz not null default now()
);

create table public.fixed_income_securities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issuer_id uuid not null references public.fixed_income_issuers(id) on delete restrict,
  security_name text not null,
  coupon_rate numeric,
  maturity_date date,
  call_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.security_identifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id uuid not null references public.fixed_income_securities(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  source text not null,
  retrieved_at timestamptz not null default now(),
  unique(user_id, identifier_type, identifier_value)
);

create table public.security_research_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id uuid not null references public.fixed_income_securities(id) on delete cascade,
  source_name text not null,
  source_url text,
  document_type text,
  source_hash text,
  observed_at timestamptz,
  retrieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.insurance_capital_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.insurance_capital_portfolios(id) on delete cascade,
  security_id uuid not null references public.fixed_income_securities(id) on delete restrict,
  market_value numeric not null check (market_value >= 0),
  as_of timestamptz not null,
  created_at timestamptz not null default now(),
  unique(portfolio_id, security_id, as_of)
);

create table public.insurance_liability_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.insurance_capital_portfolios(id) on delete cascade,
  label text not null,
  horizon_days integer not null check (horizon_days >= 0),
  amount numeric not null check (amount >= 0),
  as_of timestamptz not null
);

create table public.insurance_capital_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.insurance_capital_portfolios(id) on delete cascade,
  rule_set text not null,
  rule_version text not null,
  effective_date date,
  result jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.insurance_capital_portfolios enable row level security;
alter table public.fixed_income_issuers enable row level security;
alter table public.fixed_income_securities enable row level security;
alter table public.security_identifiers enable row level security;
alter table public.security_research_evidence enable row level security;
alter table public.insurance_capital_positions enable row level security;
alter table public.insurance_liability_buckets enable row level security;
alter table public.insurance_capital_assessments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['insurance_capital_portfolios','fixed_income_issuers','fixed_income_securities','security_identifiers','security_research_evidence','insurance_capital_positions','insurance_liability_buckets','insurance_capital_assessments']
  loop
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;
