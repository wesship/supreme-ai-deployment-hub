create table if not exists public.ai_film_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('owner','producer','director','writer','editor','reviewer','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  permissions jsonb not null default '{}'::jsonb,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (user_id is not null or email is not null),
  unique(project_id, email)
);

create table if not exists public.ai_film_activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_film_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, snapshot_date)
);

create table if not exists public.ai_film_commercial_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  export_job_id uuid references public.ai_film_export_jobs(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  release_type text not null check (release_type in ('festival','streaming','theatrical','broadcast','direct','licensing')),
  territory text not null default 'worldwide',
  rights_model text not null default 'all-rights',
  status text not null default 'planning' check (status in ('planning','submitted','approved','scheduled','released','withdrawn')),
  release_date date,
  revenue_model jsonb not null default '{}'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_film_collaborators_project_idx on public.ai_film_collaborators(project_id, status);
create index if not exists ai_film_activity_events_project_idx on public.ai_film_activity_events(project_id, created_at desc);
create index if not exists ai_film_commercial_releases_project_idx on public.ai_film_commercial_releases(project_id, status);

alter table public.ai_film_collaborators enable row level security;
alter table public.ai_film_activity_events enable row level security;
alter table public.ai_film_analytics_snapshots enable row level security;
alter table public.ai_film_commercial_releases enable row level security;

create policy "owners manage ai film collaborators" on public.ai_film_collaborators for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film activity events" on public.ai_film_activity_events for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film analytics snapshots" on public.ai_film_analytics_snapshots for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film commercial releases" on public.ai_film_commercial_releases for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());