-- Release 4: review, approval, release checklist, versions, and render queue.

create table if not exists public.ai_film_asset_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  asset_id uuid not null references public.ai_film_assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  change_note text,
  created_at timestamptz not null default now(),
  unique(asset_id, version)
);

create table if not exists public.ai_film_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('asset','scene','release')),
  target_id uuid not null,
  review_type text not null check (review_type in ('producer','director','canon','technical')),
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected')),
  summary text,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, target_type, target_id, review_type)
);

create table if not exists public.ai_film_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.ai_film_reviews(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_film_release_checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  label text not null,
  category text not null,
  required boolean not null default true,
  completed boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, item_key)
);

create table if not exists public.ai_film_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  scene_id uuid references public.ai_film_scenes(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('storyboard','keyframe','video','voice','music','trailer','export')),
  provider text not null default 'unassigned',
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  priority integer not null default 50 check (priority between 1 and 100),
  progress integer not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ai_film_reviews_project_status_idx on public.ai_film_reviews(project_id, status);
create index if not exists ai_film_release_checklists_project_idx on public.ai_film_release_checklists(project_id, completed);
create index if not exists ai_film_render_jobs_project_status_idx on public.ai_film_render_jobs(project_id, status, priority desc);
create index if not exists ai_film_asset_versions_asset_idx on public.ai_film_asset_versions(asset_id, version desc);

alter table public.ai_film_asset_versions enable row level security;
alter table public.ai_film_reviews enable row level security;
alter table public.ai_film_review_comments enable row level security;
alter table public.ai_film_release_checklists enable row level security;
alter table public.ai_film_render_jobs enable row level security;

create policy "owners manage ai film asset versions" on public.ai_film_asset_versions for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film reviews" on public.ai_film_reviews for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film review comments" on public.ai_film_review_comments for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and author_id = auth.uid());
create policy "owners manage ai film release checklists" on public.ai_film_release_checklists for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film render jobs" on public.ai_film_render_jobs for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
