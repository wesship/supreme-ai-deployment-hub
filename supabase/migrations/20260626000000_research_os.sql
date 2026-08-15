-- Hermes Research OS persistence tables
-- Safe to run multiple times.

create table if not exists public.dkos_research_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  query text not null,
  source text not null,
  title text not null,
  url text,
  snippet text,
  score numeric default 0,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dkos_research_evidence_tenant_created
  on public.dkos_research_evidence (tenant_id, created_at desc);

create index if not exists idx_dkos_research_evidence_source_score
  on public.dkos_research_evidence (source, score desc);

create table if not exists public.clay_lead_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  company text,
  person text,
  role text,
  website text,
  linkedin_url text,
  source_url text,
  confidence numeric default 0,
  metadata jsonb default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  enriched_at timestamptz
);

create index if not exists idx_clay_lead_queue_status_created
  on public.clay_lead_queue (status, created_at desc);
