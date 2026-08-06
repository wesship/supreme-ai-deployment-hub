-- D3VONN multi-provider AI film orchestrator core schema

create extension if not exists pgcrypto;

create table if not exists public.film_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  status text not null default 'development' check (status in ('development','preproduction','production','postproduction','completed','archived')),
  canon_version text not null default '1.0',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug),
  unique(id, owner_id)
);

create table if not exists public.film_characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  visual_identity jsonb not null default '{}'::jsonb,
  wardrobe_rules jsonb not null default '[]'::jsonb,
  forbidden_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade
);

create table if not exists public.film_canon_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rule_key text not null,
  rule_type text not null default 'required' check (rule_type in ('required','forbidden','reference','event_lock')),
  description text not null,
  rule_data jsonb not null default '{}'::jsonb,
  severity text not null default 'blocking' check (severity in ('advisory','warning','blocking')),
  created_at timestamptz not null default now(),
  unique(project_id, rule_key),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade
);

create table if not exists public.film_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scene_number integer not null,
  title text not null,
  synopsis text,
  screenplay text,
  emotional_intent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, scene_number),
  unique(id, owner_id),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade
);

create table if not exists public.film_shots (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null,
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shot_number integer not null,
  title text not null,
  prompt text not null,
  negative_prompt text,
  shot_type text,
  duration_seconds numeric(6,2),
  aspect_ratio text not null default '2.39:1',
  preferred_provider text,
  fallback_providers jsonb not null default '[]'::jsonb,
  parallel_generation boolean not null default false,
  canon_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','queued','generating','review','approved','rejected','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scene_id, shot_number),
  unique(id, owner_id),
  foreign key (scene_id, owner_id) references public.film_scenes(id, owner_id) on delete cascade,
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade
);

create table if not exists public.film_reference_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  shot_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('character','wardrobe','location','style','opening_frame','closing_frame','audio','other')),
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade,
  foreign key (shot_id, owner_id) references public.film_shots(id, owner_id) on delete cascade
);

create table if not exists public.film_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  shot_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text,
  external_job_id text,
  capability text not null,
  status text not null default 'queued' check (status in ('queued','submitted','running','completed','failed','cancelled')),
  request_redacted jsonb not null default '{}'::jsonb,
  response_redacted jsonb not null default '{}'::jsonb,
  cost_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id, owner_id),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade,
  foreign key (shot_id, owner_id) references public.film_shots(id, owner_id) on delete cascade
);

create table if not exists public.film_generation_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  project_id uuid not null,
  shot_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text,
  prompt_version text,
  storage_path text not null,
  mime_type text,
  duration_seconds numeric(6,2),
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(id, owner_id),
  foreign key (job_id, owner_id) references public.film_generation_jobs(id, owner_id) on delete cascade,
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade,
  foreign key (shot_id, owner_id) references public.film_shots(id, owner_id) on delete cascade
);

create table if not exists public.film_qa_reviews (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null,
  project_id uuid not null,
  shot_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_type text not null default 'automated' check (reviewer_type in ('automated','human')),
  scores jsonb not null default '{}'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  decision text not null check (decision in ('approve','approve_with_minor_edit','regenerate','reject')),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (output_id, owner_id) references public.film_generation_outputs(id, owner_id) on delete cascade,
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade,
  foreign key (shot_id, owner_id) references public.film_shots(id, owner_id) on delete cascade
);

create table if not exists public.film_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  enabled boolean not null default false,
  capabilities jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, provider)
);

create table if not exists public.film_timeline_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  output_id uuid,
  owner_id uuid not null references auth.users(id) on delete cascade,
  track text not null default 'video',
  sequence_index integer not null,
  in_seconds numeric(10,3) not null default 0,
  out_seconds numeric(10,3),
  transition jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, track, sequence_index),
  foreign key (project_id, owner_id) references public.film_projects(id, owner_id) on delete cascade,
  foreign key (output_id, owner_id) references public.film_generation_outputs(id, owner_id) on delete set null
);

create index if not exists film_projects_owner_idx on public.film_projects(owner_id);
create index if not exists film_scenes_project_idx on public.film_scenes(project_id);
create index if not exists film_shots_scene_idx on public.film_shots(scene_id);
create index if not exists film_jobs_shot_idx on public.film_generation_jobs(shot_id);
create index if not exists film_outputs_shot_idx on public.film_generation_outputs(shot_id);
create index if not exists film_canon_rules_owner_idx on public.film_canon_rules(owner_id);
create index if not exists film_characters_owner_idx on public.film_characters(owner_id);
create index if not exists film_generation_jobs_owner_idx on public.film_generation_jobs(owner_id);
create index if not exists film_generation_jobs_project_idx on public.film_generation_jobs(project_id);
create index if not exists film_generation_outputs_job_idx on public.film_generation_outputs(job_id);
create index if not exists film_generation_outputs_owner_idx on public.film_generation_outputs(owner_id);
create index if not exists film_generation_outputs_project_idx on public.film_generation_outputs(project_id);
create index if not exists film_qa_reviews_output_idx on public.film_qa_reviews(output_id);
create index if not exists film_qa_reviews_owner_idx on public.film_qa_reviews(owner_id);
create index if not exists film_qa_reviews_project_idx on public.film_qa_reviews(project_id);
create index if not exists film_qa_reviews_shot_idx on public.film_qa_reviews(shot_id);
create index if not exists film_reference_assets_owner_idx on public.film_reference_assets(owner_id);
create index if not exists film_reference_assets_project_idx on public.film_reference_assets(project_id);
create index if not exists film_reference_assets_shot_idx on public.film_reference_assets(shot_id);
create index if not exists film_scenes_owner_idx on public.film_scenes(owner_id);
create index if not exists film_shots_owner_idx on public.film_shots(owner_id);
create index if not exists film_shots_project_idx on public.film_shots(project_id);
create index if not exists film_timeline_items_output_idx on public.film_timeline_items(output_id);
create index if not exists film_timeline_items_owner_idx on public.film_timeline_items(owner_id);

create index if not exists film_characters_project_owner_idx on public.film_characters(project_id, owner_id);
create index if not exists film_canon_rules_project_owner_idx on public.film_canon_rules(project_id, owner_id);
create index if not exists film_scenes_project_owner_idx on public.film_scenes(project_id, owner_id);
create index if not exists film_shots_scene_owner_idx on public.film_shots(scene_id, owner_id);
create index if not exists film_shots_project_owner_idx on public.film_shots(project_id, owner_id);
create index if not exists film_reference_assets_project_owner_idx on public.film_reference_assets(project_id, owner_id);
create index if not exists film_reference_assets_shot_owner_idx on public.film_reference_assets(shot_id, owner_id);
create index if not exists film_jobs_project_owner_idx on public.film_generation_jobs(project_id, owner_id);
create index if not exists film_jobs_shot_owner_idx on public.film_generation_jobs(shot_id, owner_id);
create index if not exists film_outputs_job_owner_idx on public.film_generation_outputs(job_id, owner_id);
create index if not exists film_outputs_project_owner_idx on public.film_generation_outputs(project_id, owner_id);
create index if not exists film_outputs_shot_owner_idx on public.film_generation_outputs(shot_id, owner_id);
create index if not exists film_qa_output_owner_idx on public.film_qa_reviews(output_id, owner_id);
create index if not exists film_qa_project_owner_idx on public.film_qa_reviews(project_id, owner_id);
create index if not exists film_qa_shot_owner_idx on public.film_qa_reviews(shot_id, owner_id);
create index if not exists film_timeline_project_owner_idx on public.film_timeline_items(project_id, owner_id);
create index if not exists film_timeline_output_owner_idx on public.film_timeline_items(output_id, owner_id);

alter table public.film_projects enable row level security;
alter table public.film_characters enable row level security;
alter table public.film_canon_rules enable row level security;
alter table public.film_scenes enable row level security;
alter table public.film_shots enable row level security;
alter table public.film_reference_assets enable row level security;
alter table public.film_generation_jobs enable row level security;
alter table public.film_generation_outputs enable row level security;
alter table public.film_qa_reviews enable row level security;
alter table public.film_provider_accounts enable row level security;
alter table public.film_timeline_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'film_projects','film_characters','film_canon_rules','film_scenes','film_shots',
    'film_reference_assets','film_generation_jobs','film_generation_outputs','film_qa_reviews',
    'film_provider_accounts','film_timeline_items'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );
    execute format('grant all on table public.%I to service_role', table_name);

    execute format('drop policy if exists %I_owner_all on public.%I', table_name, table_name);
    execute format(
      'create policy %I_owner_all on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name, table_name
    );
  end loop;
end $$;

comment on table public.film_provider_accounts is 'Provider metadata only. API secrets must remain in server-side environment variables and never be stored here.';
