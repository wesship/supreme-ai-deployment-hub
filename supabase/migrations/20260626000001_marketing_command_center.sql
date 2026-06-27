-- D3VONN Marketing Command Center schema
-- Stores campaigns, assets, review results, and analytics feedback loops.

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text unique not null,
  name text not null,
  status text not null default 'DRAFT',
  primary_cta text,
  primary_message text,
  channels text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  channel text not null,
  label text not null,
  subject text,
  body text not null,
  status text not null default 'DRAFT',
  character_count integer generated always as (char_length(body)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.marketing_assets(id) on delete cascade,
  reviewer_agent text not null,
  decision text not null,
  score numeric,
  issues jsonb not null default '[]'::jsonb,
  suggested_revision text,
  required_sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  asset_id uuid references public.marketing_assets(id) on delete cascade,
  channel text not null,
  metric_name text not null,
  metric_value numeric not null default 0,
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_assets enable row level security;
alter table public.marketing_reviews enable row level security;
alter table public.marketing_metrics enable row level security;

create policy "marketing_campaigns_owner_select" on public.marketing_campaigns
  for select using (auth.uid() = owner_id);

create policy "marketing_campaigns_owner_write" on public.marketing_campaigns
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "marketing_assets_owner_select" on public.marketing_assets
  for select using (auth.uid() = owner_id);

create policy "marketing_assets_owner_write" on public.marketing_assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "marketing_reviews_owner_select" on public.marketing_reviews
  for select using (
    exists (
      select 1 from public.marketing_assets a
      where a.id = marketing_reviews.asset_id and a.owner_id = auth.uid()
    )
  );

create policy "marketing_metrics_owner_select" on public.marketing_metrics
  for select using (
    exists (
      select 1 from public.marketing_campaigns c
      where c.id = marketing_metrics.campaign_id and c.owner_id = auth.uid()
    )
  );
