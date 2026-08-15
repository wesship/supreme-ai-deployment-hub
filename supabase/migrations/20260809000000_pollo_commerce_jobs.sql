create table if not exists public.ai_film_commerce_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'pollo',
  model text not null default 'pollo-v2-5',
  task_id text unique,
  status text not null default 'reserved' check (status in ('reserved','submitted','processing','succeeded','completed','failed','cancelled')),
  request jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  provider_event jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  handoff_status text not null default 'pending' check (handoff_status in ('pending','queued','completed','not_applicable','failed')),
  handoff_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ai_film_commerce_jobs_owner_idx on public.ai_film_commerce_jobs(owner_id, created_at desc);
create index if not exists ai_film_commerce_jobs_handoff_idx on public.ai_film_commerce_jobs(handoff_status, created_at asc);

alter table public.ai_film_commerce_jobs enable row level security;
create policy "owners manage ai film commerce jobs" on public.ai_film_commerce_jobs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update on public.ai_film_commerce_jobs to authenticated;
grant all on public.ai_film_commerce_jobs to service_role;
