-- Devonn.ai Operator Command Center tables
-- Created: 2026-05-27
-- Purpose: support OCC admin dashboard metrics, logs, approvals, errors, plans, and RAG document management.

create extension if not exists pgcrypto;

-- AI request/cost logs
create table if not exists public.ai_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  session_id text null,
  provider text not null default 'openai',
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer generated always as (prompt_tokens + completion_tokens) stored,
  cost_usd numeric(12,6) not null default 0,
  latency_ms integer null,
  status text not null default 'success' check (status in ('success','error','timeout','cancelled')),
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_request_logs_created_at on public.ai_request_logs (created_at desc);
create index if not exists idx_ai_request_logs_user_id on public.ai_request_logs (user_id);
create index if not exists idx_ai_request_logs_status on public.ai_request_logs (status);
create index if not exists idx_ai_request_logs_model on public.ai_request_logs (model);

-- Tool call logs
create table if not exists public.tool_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  tool_name text not null,
  provider text null,
  input_summary text null,
  output_summary text null,
  latency_ms integer null,
  status text not null default 'success' check (status in ('success','error','timeout','skipped')),
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_call_logs_created_at on public.tool_call_logs (created_at desc);
create index if not exists idx_tool_call_logs_user_id on public.tool_call_logs (user_id);
create index if not exists idx_tool_call_logs_status on public.tool_call_logs (status);
create index if not exists idx_tool_call_logs_tool_name on public.tool_call_logs (tool_name);

-- Agent activity logs
create table if not exists public.agent_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  agent_name text not null,
  task_id text null,
  event_type text not null default 'activity',
  message text null,
  status text not null default 'success' check (status in ('success','error','running','queued','completed','failed','skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_activity_logs_created_at on public.agent_activity_logs (created_at desc);
create index if not exists idx_agent_activity_logs_user_id on public.agent_activity_logs (user_id);
create index if not exists idx_agent_activity_logs_agent_name on public.agent_activity_logs (agent_name);
create index if not exists idx_agent_activity_logs_status on public.agent_activity_logs (status);

-- Error logs
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  source text not null default 'backend',
  severity text not null default 'error' check (severity in ('debug','info','warning','error','critical')),
  message text not null,
  stack_trace text null,
  route text null,
  resolved boolean not null default false,
  resolved_by uuid null,
  resolved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_created_at on public.error_logs (created_at desc);
create index if not exists idx_error_logs_resolved on public.error_logs (resolved);
create index if not exists idx_error_logs_severity on public.error_logs (severity);

-- Human approval queue
create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  requested_by uuid null,
  request_type text not null,
  title text not null,
  description text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  reviewed_by uuid null,
  review_note text null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_approval_queue_status on public.approval_queue (status);
create index if not exists idx_approval_queue_requested_at on public.approval_queue (requested_at desc);
create index if not exists idx_approval_queue_priority on public.approval_queue (priority);

-- User plan and usage limits
create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan text not null default 'free' check (plan in ('free','pro','business','enterprise')),
  messages_used integer not null default 0,
  messages_limit integer not null default 50,
  uploads_used integer not null default 0,
  uploads_limit integer not null default 5,
  tokens_used integer not null default 0,
  tokens_limit integer not null default 100000,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_plans_plan on public.user_plans (plan);
create index if not exists idx_user_plans_updated_at on public.user_plans (updated_at desc);

-- RAG document registry
create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  title text not null,
  source text null,
  file_name text null,
  mime_type text null,
  storage_path text null,
  chunk_count integer not null default 0,
  token_count integer not null default 0,
  status text not null default 'active' check (status in ('active','processing','failed','deleted','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rag_documents_created_at on public.rag_documents (created_at desc);
create index if not exists idx_rag_documents_user_id on public.rag_documents (user_id);
create index if not exists idx_rag_documents_status on public.rag_documents (status);

-- Reusable updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_plans_updated_at on public.user_plans;
create trigger trg_user_plans_updated_at
before update on public.user_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_rag_documents_updated_at on public.rag_documents;
create trigger trg_rag_documents_updated_at
before update on public.rag_documents
for each row execute function public.set_updated_at();

-- RLS baseline
alter table public.ai_request_logs enable row level security;
alter table public.tool_call_logs enable row level security;
alter table public.agent_activity_logs enable row level security;
alter table public.error_logs enable row level security;
alter table public.approval_queue enable row level security;
alter table public.user_plans enable row level security;
alter table public.rag_documents enable row level security;

-- Service role bypasses RLS automatically in Supabase. The OCC backend uses the service role server-side.
-- Optional user self-read policies can be added later once product requirements are finalized.
