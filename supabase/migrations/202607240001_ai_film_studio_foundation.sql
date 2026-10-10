-- D3VONN.IO AI Film Studio foundation
-- Knowledge Core, Canon Manager, Asset Manager, and scene-production relationships.

create extension if not exists pgcrypto;

create type public.ai_film_record_status as enum ('draft', 'selected', 'approved', 'canon', 'archived');
create type public.ai_film_asset_type as enum ('image', 'video', 'audio', 'document', 'storyboard', 'prompt', 'other');
create type public.ai_film_rule_severity as enum ('info', 'warning', 'error', 'blocking');

create table public.ai_film_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  format text not null default 'feature',
  status public.ai_film_record_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.ai_film_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type public.ai_film_asset_type not null,
  title text not null,
  description text,
  storage_path text,
  source_filename text,
  category text not null,
  subcategory text,
  status public.ai_film_record_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_film_assets_project_checksum_uidx
  on public.ai_film_assets(project_id, checksum)
  where checksum is not null;
create index ai_film_assets_project_category_idx on public.ai_film_assets(project_id, category, subcategory);
create index ai_film_assets_tags_gin_idx on public.ai_film_assets using gin(tags);
create index ai_film_assets_metadata_gin_idx on public.ai_film_assets using gin(metadata);

create table public.ai_film_entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  name text not null,
  slug text not null,
  description text,
  status public.ai_film_record_status not null default 'draft',
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, entity_type, slug)
);

create table public.ai_film_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_entity_id uuid references public.ai_film_entities(id) on delete cascade,
  source_asset_id uuid references public.ai_film_assets(id) on delete cascade,
  relationship_type text not null,
  target_entity_id uuid references public.ai_film_entities(id) on delete cascade,
  target_asset_id uuid references public.ai_film_assets(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((source_entity_id is not null) <> (source_asset_id is not null)),
  check ((target_entity_id is not null) <> (target_asset_id is not null))
);

create table public.ai_film_canon_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rule_key text not null,
  title text not null,
  description text not null,
  applies_to text[] not null default '{}',
  severity public.ai_film_rule_severity not null default 'error',
  validator jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, rule_key)
);

create table public.ai_film_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_film_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  episode_number integer,
  scene_number integer not null,
  title text not null,
  location text,
  synopsis text,
  screenplay text,
  production_package jsonb not null default '{}'::jsonb,
  status public.ai_film_record_status not null default 'draft',
  canon_validation jsonb not null default '{"status":"pending","violations":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, episode_number, scene_number)
);

create table public.ai_film_scene_assets (
  scene_id uuid not null references public.ai_film_scenes(id) on delete cascade,
  asset_id uuid not null references public.ai_film_assets(id) on delete cascade,
  usage_type text not null default 'reference',
  notes text,
  created_at timestamptz not null default now(),
  primary key(scene_id, asset_id, usage_type)
);

alter table public.ai_film_projects enable row level security;
alter table public.ai_film_assets enable row level security;
alter table public.ai_film_entities enable row level security;
alter table public.ai_film_relationships enable row level security;
alter table public.ai_film_canon_rules enable row level security;
alter table public.ai_film_scenes enable row level security;
alter table public.ai_film_scene_assets enable row level security;

create policy "owners manage ai film projects" on public.ai_film_projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film assets" on public.ai_film_assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film entities" on public.ai_film_entities
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film relationships" on public.ai_film_relationships
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film canon rules" on public.ai_film_canon_rules
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film scenes" on public.ai_film_scenes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners manage ai film scene assets" on public.ai_film_scene_assets
  for all using (
    exists (select 1 from public.ai_film_scenes s where s.id = scene_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.ai_film_scenes s where s.id = scene_id and s.owner_id = auth.uid())
  );

create or replace function public.ai_film_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_film_projects_touch before update on public.ai_film_projects
for each row execute function public.ai_film_touch_updated_at();
create trigger ai_film_assets_touch before update on public.ai_film_assets
for each row execute function public.ai_film_touch_updated_at();
create trigger ai_film_entities_touch before update on public.ai_film_entities
for each row execute function public.ai_film_touch_updated_at();
create trigger ai_film_canon_rules_touch before update on public.ai_film_canon_rules
for each row execute function public.ai_film_touch_updated_at();
create trigger ai_film_scenes_touch before update on public.ai_film_scenes
for each row execute function public.ai_film_touch_updated_at();
