create extension if not exists pgcrypto;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.workspaces (id uuid primary key);
create table public.users (id uuid primary key);
create table public.leads (id uuid primary key, workspace_id uuid not null references public.workspaces(id));
create table public.households (id uuid primary key, workspace_id uuid not null references public.workspaces(id));
create table public.people (id uuid primary key, workspace_id uuid not null references public.workspaces(id));
create table public.roles (id uuid primary key, name text not null unique);
create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.users(id),
  role_id uuid references public.roles(id),
  status text not null check (status in ('active', 'inactive')),
  unique (workspace_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  lead_id uuid references public.leads(id),
  owner_id uuid references public.users(id),
  title text not null,
  due_at timestamptz,
  priority text,
  status text,
  created_by uuid references public.users(id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  lead_id uuid references public.leads(id),
  actor_id uuid references public.users(id),
  activity_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.release_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  entity_type text not null,
  entity_id uuid,
  rule_code text not null,
  severity text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  unique (workspace_id, entity_type, entity_id, rule_code)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create role primetime_app nologin;
grant usage on schema public, auth to primetime_app;
grant select, insert, update on all tables in schema public to primetime_app;
grant execute on function auth.uid() to primetime_app;
