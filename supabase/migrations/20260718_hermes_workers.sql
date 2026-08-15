-- Persistent Hermes distributed worker registry and task leases.

create table if not exists public.hermes_workers (
    id uuid primary key default gen_random_uuid(),
    worker_id text not null unique,
    hostname text not null,
    region text not null,
    runtime text not null,
    runtime_version text not null,
    capabilities jsonb not null default '[]'::jsonb,
    cpu_cores double precision not null default 1,
    memory_mb integer not null default 512,
    gpu_count integer not null default 0,
    max_leases integer not null check (max_leases > 0),
    active_leases integer not null default 0 check (active_leases >= 0),
    status text not null check (status in ('healthy','busy','draining','offline','lost')),
    registered_at timestamptz not null,
    last_heartbeat_at timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    version_counter bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists hermes_workers_status_region_idx
    on public.hermes_workers (status, region, worker_id);
create index if not exists hermes_workers_heartbeat_idx
    on public.hermes_workers (last_heartbeat_at);

create table if not exists public.hermes_worker_leases (
    id uuid primary key default gen_random_uuid(),
    lease_id text not null unique,
    task_id uuid not null references public.hermes_tasks(id) on delete cascade,
    worker_id text not null references public.hermes_workers(worker_id) on delete restrict,
    capabilities jsonb not null default '[]'::jsonb,
    acquired_at timestamptz not null,
    renewed_at timestamptz not null,
    expires_at timestamptz not null,
    status text not null check (status in ('active','released','expired','cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists hermes_worker_leases_one_active_per_task
    on public.hermes_worker_leases (task_id)
    where status = 'active';
create index if not exists hermes_worker_leases_worker_status_idx
    on public.hermes_worker_leases (worker_id, status);
create index if not exists hermes_worker_leases_expiry_idx
    on public.hermes_worker_leases (expires_at)
    where status = 'active';

alter table public.hermes_workers enable row level security;
alter table public.hermes_worker_leases enable row level security;

-- Service-role backend access remains governed by the existing Supabase service key.
-- No anonymous or authenticated-user policies are created for worker control data.
