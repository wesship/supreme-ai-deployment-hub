-- Client AI durable Hermes memory commit ledger.
-- Service-role backend owns writes; browser roles receive no direct table access.

create table if not exists public.client_ai_memory_commits (
  id uuid primary key default gen_random_uuid(),
  commit_id text not null unique,
  profile_id uuid not null references public.client_ai_profiles(id) on delete cascade,
  source_id uuid references public.client_ai_sources(id) on delete set null,
  tenant_id text not null,
  run_id text not null,
  document_id text not null,
  namespace text not null,
  index_name text not null,
  vector_count integer not null default 0 check (vector_count >= 0),
  status text not null default 'committed'
    check (status in ('committed','revoked','failed')),
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_ai_memory_commits_profile_status_idx
  on public.client_ai_memory_commits (profile_id, status, created_at desc);

create index if not exists client_ai_memory_commits_source_idx
  on public.client_ai_memory_commits (source_id, created_at desc);

alter table public.client_ai_memory_commits enable row level security;
revoke all on table public.client_ai_memory_commits from anon, authenticated;

-- Backend-only Data API access for the FastAPI service role.
grant select, insert, update, delete on table public.client_ai_memory_commits to service_role;
