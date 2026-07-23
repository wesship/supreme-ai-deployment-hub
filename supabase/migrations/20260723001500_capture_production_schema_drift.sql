begin;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null,
  title text not null,
  description text,
  payload jsonb default '{}'::jsonb,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_approval_requests_status on public.approval_requests(status);

create table if not exists public.rag_document_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  document_id text not null,
  filename text not null,
  file_type text not null default 'text',
  file_size_bytes integer not null default 0,
  namespace text not null default 'default',
  chunk_count integer not null default 0,
  vector_count integer not null default 0,
  status text not null default 'success',
  error_message text,
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_rag_document_logs_user_id on public.rag_document_logs(user_id);

create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action_type text not null,
  action_data jsonb not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_queue_created_at on public.approval_queue(created_at desc);
create index if not exists idx_approval_queue_status on public.approval_queue(status);

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  filename text not null,
  file_size integer,
  chunk_count integer not null default 0,
  namespace text,
  status text not null default 'indexed',
  retrieval_hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.approval_requests enable row level security;
alter table public.rag_document_logs enable row level security;
alter table public.approval_queue enable row level security;
alter table public.rag_documents enable row level security;

revoke all privileges on table public.approval_requests from public, anon, authenticated;
revoke all privileges on table public.rag_document_logs from public, anon, authenticated;
grant all privileges on table public.approval_requests to service_role;
grant all privileges on table public.rag_document_logs to service_role;

drop policy if exists "Deny direct browser access" on public.approval_requests;
create policy "Deny direct browser access" on public.approval_requests
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Deny direct browser access" on public.rag_document_logs;
create policy "Deny direct browser access" on public.rag_document_logs
  for all to anon, authenticated using (false) with check (false);

revoke all privileges on table public.approval_queue from public, anon, authenticated;
revoke all privileges on table public.rag_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.approval_queue to authenticated;
grant select, insert, update, delete on table public.rag_documents to authenticated;
grant all privileges on table public.approval_queue to service_role;
grant all privileges on table public.rag_documents to service_role;

drop policy if exists "Admin manage approvals" on public.approval_queue;
drop policy if exists "Users insert own approvals" on public.approval_queue;
drop policy if exists "Users read own approvals" on public.approval_queue;
create policy "Admin manage approvals" on public.approval_queue
  for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Users insert own approvals" on public.approval_queue
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users read own approvals" on public.approval_queue
  for select to authenticated
  using (auth.uid() = user_id or (auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "Admin manage rag_documents" on public.rag_documents;
drop policy if exists "Users insert own rag_documents" on public.rag_documents;
drop policy if exists "Users read own rag_documents" on public.rag_documents;
create policy "Admin manage rag_documents" on public.rag_documents
  for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Users insert own rag_documents" on public.rag_documents
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users read own rag_documents" on public.rag_documents
  for select to authenticated
  using (auth.uid() = user_id or (auth.jwt()->'app_metadata'->>'role') = 'admin');

comment on table public.approval_requests is 'Legacy production-drift table retained for compatibility; backend-only pending removal review in issue #507.';
comment on table public.rag_document_logs is 'Legacy production-drift table retained for compatibility; backend-only pending removal review in issue #507.';

commit;
