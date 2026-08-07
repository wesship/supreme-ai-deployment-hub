-- Agent OS governed policy + approval persistence.
-- Backend-only control plane; no direct browser access.

create table if not exists public.agent_os_workspace_policies (
  workspace_id uuid primary key references public.primetime_workspaces(id) on delete cascade,
  kill_switch_enabled boolean not null default false,
  disabled_agents text[] not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint agent_os_disabled_agents_bounded check (cardinality(disabled_agents) <= 100)
);

create table if not exists public.agent_os_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete cascade,
  action text not null,
  agent_name text,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint agent_os_approval_action_nonempty check (length(trim(action)) > 0),
  constraint agent_os_approval_expiry_after_approval check (expires_at > approved_at)
);

create index if not exists agent_os_approvals_workspace_active_idx
  on public.agent_os_approvals (workspace_id, action, expires_at desc)
  where revoked_at is null;

alter table public.agent_os_workspace_policies enable row level security;
alter table public.agent_os_approvals enable row level security;

revoke all on table public.agent_os_workspace_policies from anon, authenticated;
revoke all on table public.agent_os_approvals from anon, authenticated;
grant select, insert, update, delete on table public.agent_os_workspace_policies to service_role;
grant select, insert, update, delete on table public.agent_os_approvals to service_role;

comment on table public.agent_os_workspace_policies is
  'Backend-only workspace Agent OS emergency policy overrides.';
comment on table public.agent_os_approvals is
  'Backend-only, time-bounded Agent OS approval evidence.';
