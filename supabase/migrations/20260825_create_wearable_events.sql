-- D3VONN Wearable OS durable event ledger.
-- Raw media is intentionally not stored here; payload should contain references or derived data.
create table if not exists public.wearable_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  occurred_at timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  adapter text not null,
  session_id text not null,
  correlation_id text not null,
  privacy_classification text not null check (privacy_classification in ('user_private','sensitive','restricted')),
  consent boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  capabilities text[] not null default '{}',
  policy_version text not null,
  trace_id text not null,
  payload_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists wearable_events_user_time_idx on public.wearable_events (user_id, occurred_at desc);
create index if not exists wearable_events_device_time_idx on public.wearable_events (device_id, occurred_at desc);
create index if not exists wearable_events_correlation_idx on public.wearable_events (correlation_id);
create index if not exists wearable_events_type_time_idx on public.wearable_events (event_type, occurred_at desc);
alter table public.wearable_events enable row level security;
-- No browser policy is granted. The authenticated API persists events through its protected backend path.
