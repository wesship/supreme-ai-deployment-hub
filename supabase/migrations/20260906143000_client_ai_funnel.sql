-- Hermes Client AI funnel
-- Backend-only intake and tenant-ready onboarding records.

create table if not exists public.client_ai_leads (
  id uuid primary key,
  client_key text not null,
  funnel_key text not null default 'default',
  email text not null,
  email_fingerprint text not null,
  source text not null default 'landing-page',
  consent_to_contact boolean not null default false,
  status text not null default 'new' check (status in ('new','qualified','onboarding','active','nurture','closed','rejected')),
  correlation_id text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_ai_leads_client_status_idx
  on public.client_ai_leads (client_key, status, created_at desc);
create index if not exists client_ai_leads_email_fingerprint_idx
  on public.client_ai_leads (email_fingerprint);

create table if not exists public.client_ai_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.client_ai_leads(id) on delete set null,
  user_id uuid,
  client_key text not null,
  display_name text,
  profile_state text not null default 'draft' check (profile_state in ('draft','training','ready','paused','archived')),
  voice_profile jsonb not null default '{}'::jsonb,
  identity_profile jsonb not null default '{}'::jsonb,
  world_profile jsonb not null default '{}'::jsonb,
  story_profile jsonb not null default '{}'::jsonb,
  mindset_profile jsonb not null default '{}'::jsonb,
  drive_profile jsonb not null default '{}'::jsonb,
  pattern_profile jsonb not null default '{}'::jsonb,
  growth_profile jsonb not null default '{}'::jsonb,
  consent_policy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_ai_profiles_client_idx
  on public.client_ai_profiles (client_key, profile_state, created_at desc);

create table if not exists public.client_ai_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.client_ai_profiles(id) on delete cascade,
  source_type text not null check (source_type in ('voice','document','note','image','video','website','social','conversation')),
  source_uri text,
  title text,
  ingestion_status text not null default 'pending' check (ingestion_status in ('pending','processing','ready','failed','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_ai_sources_profile_status_idx
  on public.client_ai_sources (profile_id, ingestion_status, created_at desc);

alter table public.client_ai_leads enable row level security;
alter table public.client_ai_profiles enable row level security;
alter table public.client_ai_sources enable row level security;

-- No browser policies in this release. Trusted FastAPI/service-role code owns intake.
revoke all on table public.client_ai_leads from anon, authenticated;
revoke all on table public.client_ai_profiles from anon, authenticated;
revoke all on table public.client_ai_sources from anon, authenticated;
