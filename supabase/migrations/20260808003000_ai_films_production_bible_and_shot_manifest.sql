create table if not exists public.ai_film_production_bibles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'active' check (status in ('draft','active','superseded','locked')),
  bible jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version)
);

create table if not exists public.ai_film_shot_manifests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bible_version integer not null check (bible_version > 0),
  manifest_version integer not null check (manifest_version > 0),
  title text not null,
  structure text not null check (structure in ('feature','episode','trailer','teaser','sequence','scene')),
  status text not null default 'draft' check (status in ('draft','active','in_production','qa','locked','superseded')),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, manifest_version)
);

create index if not exists idx_ai_film_bibles_project_status on public.ai_film_production_bibles(project_id,status,version desc);
create index if not exists idx_ai_film_shot_manifests_project_status on public.ai_film_shot_manifests(project_id,status,manifest_version desc);
create index if not exists idx_ai_film_shot_manifest_gin on public.ai_film_shot_manifests using gin(manifest);

alter table public.ai_film_production_bibles enable row level security;
alter table public.ai_film_shot_manifests enable row level security;

create policy "ai_film_bibles_owner_all" on public.ai_film_production_bibles
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "ai_film_manifests_owner_all" on public.ai_film_shot_manifests
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
