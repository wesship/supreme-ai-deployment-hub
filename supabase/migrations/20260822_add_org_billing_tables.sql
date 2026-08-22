create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.primetime_workspaces(id) on delete set null,
  stripe_customer_id text null,
  stripe_subscription_id text null unique,
  status text not null default 'unknown',
  price_id text null,
  currency text null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_org_subscriptions_workspace_id on public.org_subscriptions(workspace_id);
create index if not exists idx_org_subscriptions_customer_id on public.org_subscriptions(stripe_customer_id);
alter table public.org_subscriptions enable row level security;
drop policy if exists org_subscriptions_service_only on public.org_subscriptions;
create policy org_subscriptions_service_only on public.org_subscriptions for all to service_role using (true) with check (true);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_billing_events_event_type_created_at on public.billing_events(event_type, created_at desc);
alter table public.billing_events enable row level security;
drop policy if exists billing_events_service_only on public.billing_events;
create policy billing_events_service_only on public.billing_events for all to service_role using (true) with check (true);
