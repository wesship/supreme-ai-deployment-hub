begin;

create table if not exists public.wearable_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  user_id text not null,
  device_id text not null,
  adapter text not null,
  session_id text not null,
  correlation_id text not null,
  privacy_classification text not null
    check (privacy_classification in ('user_private', 'sensitive', 'restricted')),
  consent boolean not null
    check (consent = true),
  payload jsonb not null default '{}'::jsonb,
  capabilities text[] not null default '{}'::text[],
  policy_version text not null,
  trace_id text not null,
  payload_hash text not null
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint wearable_events_event_id_len check (char_length(event_id) between 1 and 200),
  constraint wearable_events_event_type_len check (char_length(event_type) between 1 and 100),
  constraint wearable_events_user_id_len check (char_length(user_id) between 1 and 200),
  constraint wearable_events_device_id_len check (char_length(device_id) between 1 and 200),
  constraint wearable_events_adapter_len check (char_length(adapter) between 1 and 100),
  constraint wearable_events_session_id_len check (char_length(session_id) between 1 and 200),
  constraint wearable_events_correlation_id_len check (char_length(correlation_id) between 1 and 200),
  constraint wearable_events_policy_version_len check (char_length(policy_version) between 1 and 100),
  constraint wearable_events_trace_id_len check (char_length(trace_id) between 1 and 200),
  constraint wearable_events_capabilities_len check (cardinality(capabilities) <= 20),
  constraint wearable_events_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists wearable_events_user_received_idx
  on public.wearable_events (user_id, received_at desc);

create index if not exists wearable_events_device_received_idx
  on public.wearable_events (device_id, received_at desc);

create index if not exists wearable_events_correlation_idx
  on public.wearable_events (correlation_id);

create index if not exists wearable_events_trace_idx
  on public.wearable_events (trace_id);

alter table public.wearable_events enable row level security;
alter table public.wearable_events force row level security;

revoke all on table public.wearable_events from public, anon, authenticated;
grant all on table public.wearable_events to service_role;

drop policy if exists wearable_events_service_role_only on public.wearable_events;
create policy wearable_events_service_role_only
  on public.wearable_events
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.wearable_events is
  'Service-only D3VONN wearable event ledger. Stores canonical metadata and derived payloads; raw media retention is prohibited by application policy.';

comment on column public.wearable_events.payload is
  'Structured/derived event payload only. Do not persist raw image, audio, or video bytes/base64 here.';

commit;
