-- D3VONN Influencer Studio: owner-scoped personas, campaigns, and asset certification.
-- This migration intentionally does not grant anonymous access and keeps all creator
-- records behind authenticated owner-scoped RLS. Backend service-role orchestration
-- remains able to operate through the existing Supabase service boundary.

create table if not exists public.influencer_personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  character_bible text not null,
  niche text not null,
  synthetic_disclosure boolean not null default true check (synthetic_disclosure = true),
  declared_age integer not null default 21 check (declared_age >= 21),
  appearance_spec jsonb not null default '{}'::jsonb,
  voice_spec jsonb not null default '{}'::jsonb,
  reference_assets jsonb not null default '[]'::jsonb,
  allowed_content jsonb not null default '[]'::jsonb,
  forbidden_content jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.influencer_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid not null references public.influencer_personas(id) on delete cascade,
  objective text not null,
  state text not null default 'draft' check (
    state in (
      'draft','planning','generating','qa','approval','ready_to_publish',
      'scheduled','published','measuring','optimizing','completed',
      'paused_approval','failed'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  hermes_goal_id uuid references public.hermes_goals(id) on delete set null,
  hermes_task_id uuid references public.hermes_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.influencer_campaign_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.influencer_campaigns(id) on delete cascade,
  persona_id uuid not null references public.influencer_personas(id) on delete cascade,
  provider text not null,
  capability text not null,
  provider_job_id text not null,
  status text not null default 'queued' check (
    status in ('queued','running','succeeded','failed','cancelled','unknown')
  ),
  ai_film_asset_id uuid references public.ai_film_assets(id) on delete set null,
  storage_path text,
  provenance jsonb not null default '{}'::jsonb,
  rights_verified boolean not null default false,
  qa_passed boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, provider, provider_job_id)
);

create index if not exists influencer_personas_owner_idx
  on public.influencer_personas(owner_id, created_at desc);
create index if not exists influencer_campaigns_owner_state_idx
  on public.influencer_campaigns(owner_id, state, created_at desc);
create index if not exists influencer_campaigns_persona_idx
  on public.influencer_campaigns(persona_id, created_at desc);
create index if not exists influencer_campaign_assets_campaign_idx
  on public.influencer_campaign_assets(campaign_id, created_at desc);
create index if not exists influencer_campaign_assets_cert_idx
  on public.influencer_campaign_assets(campaign_id, rights_verified, qa_passed);

grant select, insert, update, delete on public.influencer_personas to authenticated;
grant select, insert, update, delete on public.influencer_campaigns to authenticated;
grant select, insert, update, delete on public.influencer_campaign_assets to authenticated;
grant all on public.influencer_personas to service_role;
grant all on public.influencer_campaigns to service_role;
grant all on public.influencer_campaign_assets to service_role;

alter table public.influencer_personas enable row level security;
alter table public.influencer_campaigns enable row level security;
alter table public.influencer_campaign_assets enable row level security;

drop policy if exists "owners manage influencer personas" on public.influencer_personas;
create policy "owners manage influencer personas"
  on public.influencer_personas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "owners manage influencer campaigns" on public.influencer_campaigns;
create policy "owners manage influencer campaigns"
  on public.influencer_campaigns
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "owners manage influencer campaign assets" on public.influencer_campaign_assets;
create policy "owners manage influencer campaign assets"
  on public.influencer_campaign_assets
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Keep updated_at monotonic without introducing another application-side clock.
create or replace function public.touch_influencer_studio_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists influencer_personas_touch_updated_at on public.influencer_personas;
create trigger influencer_personas_touch_updated_at
before update on public.influencer_personas
for each row execute function public.touch_influencer_studio_updated_at();

drop trigger if exists influencer_campaigns_touch_updated_at on public.influencer_campaigns;
create trigger influencer_campaigns_touch_updated_at
before update on public.influencer_campaigns
for each row execute function public.touch_influencer_studio_updated_at();

drop trigger if exists influencer_campaign_assets_touch_updated_at on public.influencer_campaign_assets;
create trigger influencer_campaign_assets_touch_updated_at
before update on public.influencer_campaign_assets
for each row execute function public.touch_influencer_studio_updated_at();
