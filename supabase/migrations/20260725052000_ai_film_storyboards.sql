create table if not exists public.ai_film_storyboards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  scene_id uuid not null references public.ai_film_scenes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','generated','review','approved','archived')),
  style_prompt text,
  frame_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scene_id)
);

create table if not exists public.ai_film_shots (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.ai_film_storyboards(id) on delete cascade,
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  scene_id uuid not null references public.ai_film_scenes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shot_number integer not null,
  shot_type text not null,
  description text not null,
  camera_angle text,
  camera_movement text,
  lens text,
  duration_seconds numeric(8,2),
  lighting text,
  blocking text,
  image_prompt text,
  status text not null default 'planned' check (status in ('planned','queued','rendered','approved','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storyboard_id, shot_number)
);

create index if not exists ai_film_storyboards_project_idx on public.ai_film_storyboards(project_id, status);
create index if not exists ai_film_shots_scene_idx on public.ai_film_shots(scene_id, shot_number);

alter table public.ai_film_storyboards enable row level security;
alter table public.ai_film_shots enable row level security;

create policy "owners manage ai film storyboards" on public.ai_film_storyboards for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film shots" on public.ai_film_shots for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());