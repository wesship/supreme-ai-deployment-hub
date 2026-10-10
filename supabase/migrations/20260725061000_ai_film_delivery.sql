create table if not exists public.ai_film_render_attempts (
  id uuid primary key default gen_random_uuid(),
  render_job_id uuid not null references public.ai_film_render_jobs(id) on delete cascade,
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued','submitted','running','succeeded','failed','cancelled')),
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  error_message text,
  cost_estimate numeric(12,4),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_film_export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  export_type text not null check (export_type in ('feature','episode','trailer','teaser','social','archive')),
  aspect_ratio text not null default '16:9',
  resolution text not null default '1920x1080',
  format text not null default 'mp4',
  status text not null default 'draft' check (status in ('draft','queued','processing','ready','failed','published')),
  manifest jsonb not null default '{}'::jsonb,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_film_subtitle_tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  export_job_id uuid references public.ai_film_export_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  label text not null,
  format text not null default 'vtt' check (format in ('vtt','srt')),
  status text not null default 'draft' check (status in ('draft','generated','review','approved')),
  cues jsonb not null default '[]'::jsonb,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(export_job_id, language_code)
);

create table if not exists public.ai_film_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  export_job_id uuid not null references public.ai_film_export_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  destination text not null check (destination in ('d3vonn','internal-review','archive','social','streaming')),
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed','withdrawn')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_id text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(export_job_id, destination)
);

create index if not exists ai_film_render_attempts_job_idx on public.ai_film_render_attempts(render_job_id, created_at desc);
create index if not exists ai_film_export_jobs_project_idx on public.ai_film_export_jobs(project_id, status);
create index if not exists ai_film_publications_project_idx on public.ai_film_publications(project_id, status);

alter table public.ai_film_render_attempts enable row level security;
alter table public.ai_film_export_jobs enable row level security;
alter table public.ai_film_subtitle_tracks enable row level security;
alter table public.ai_film_publications enable row level security;

create policy "owners manage ai film render attempts" on public.ai_film_render_attempts for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film export jobs" on public.ai_film_export_jobs for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film subtitle tracks" on public.ai_film_subtitle_tracks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage ai film publications" on public.ai_film_publications for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());