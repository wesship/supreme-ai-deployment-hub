create table if not exists public.jetson_devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  display_name text not null,
  state text not null default 'enrolled' check (state in ('enrolled','online','offline','revoked','quarantined')),
  hardware_model text,
  firmware_version text,
  model_version text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jetson_telemetry (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.jetson_devices(id) on delete cascade,
  observed_at timestamptz not null,
  state text not null check (state in ('enrolled','online','offline','revoked','quarantined')),
  cpu_percent double precision not null check (cpu_percent between 0 and 100),
  gpu_percent double precision not null check (gpu_percent between 0 and 100),
  memory_percent double precision not null check (memory_percent between 0 and 100),
  temperature_c double precision not null,
  model_version text,
  firmware_version text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jetson_commands (
  id uuid primary key default gen_random_uuid(),
  command_id text not null unique,
  request_id text not null,
  device_id uuid not null references public.jetson_devices(id) on delete restrict,
  kind text not null,
  actor_id text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','denied','dispatched','succeeded','failed','expired','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  decision_reason text,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.jetson_command_audit (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.jetson_commands(id) on delete restrict,
  event_type text not null,
  actor_id text,
  device_id uuid references public.jetson_devices(id) on delete restrict,
  request_id text,
  outcome text not null,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists jetson_commands_request_id_idx on public.jetson_commands(request_id);
create index if not exists jetson_telemetry_device_observed_idx on public.jetson_telemetry(device_id, observed_at desc);
create index if not exists jetson_commands_device_created_idx on public.jetson_commands(device_id, created_at desc);
create index if not exists jetson_command_audit_command_created_idx on public.jetson_command_audit(command_id, created_at desc);
create index if not exists jetson_devices_state_idx on public.jetson_devices(state);

alter table public.jetson_devices enable row level security;
alter table public.jetson_telemetry enable row level security;
alter table public.jetson_commands enable row level security;
alter table public.jetson_command_audit enable row level security;

revoke all on public.jetson_devices from anon, authenticated;
revoke all on public.jetson_telemetry from anon, authenticated;
revoke all on public.jetson_commands from anon, authenticated;
revoke all on public.jetson_command_audit from anon, authenticated;
