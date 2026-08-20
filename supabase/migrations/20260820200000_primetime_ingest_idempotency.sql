begin;

-- Durable duplicate guard for governed ingestion. Redis is only a fast lock;
-- this table remains the source of truth for workspace + idempotency uniqueness.
create table if not exists public.primetime_ingest_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_hash text not null check (length(request_hash) = 64),
  request_id text not null check (length(request_id) between 8 and 200),
  status text not null default 'claimed' check (status in ('claimed','accepted','failed')),
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create index if not exists primetime_ingest_idempotency_workspace_created_idx
  on public.primetime_ingest_idempotency(workspace_id, created_at desc);

alter table public.primetime_ingest_idempotency enable row level security;
alter table public.primetime_ingest_idempotency force row level security;

drop policy if exists "primetime ingest idempotency workspace members" on public.primetime_ingest_idempotency;
create policy "primetime ingest idempotency workspace members"
on public.primetime_ingest_idempotency for select to authenticated
using (private.is_active_workspace_member(workspace_id));

-- Writes are performed by the backend after authentication/membership checks.
-- No client update/delete policy is provided.

drop policy if exists "primetime ingest idempotency backend insert" on public.primetime_ingest_idempotency;
create policy "primetime ingest idempotency backend insert"
on public.primetime_ingest_idempotency for insert to authenticated
with check (private.is_active_workspace_member(workspace_id));

commit;
