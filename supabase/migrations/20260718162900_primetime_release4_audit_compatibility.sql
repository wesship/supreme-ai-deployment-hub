-- PRIMETIME Release 4 preflight compatibility
-- The historical Release 4 migration declared audit_event_id as uuid while the canonical audit id is bigint.
-- Pre-create the two dependent tables with the correct key type so the immutable historical migration remains runnable.

create table if not exists public.primetime_ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  name text not null,
  slug text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft','active','suspended','retired')),
  requires_approval_for jsonb not null default '[]',
  created_by uuid references public.primetime_workspace_memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.primetime_ai_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id uuid references public.primetime_ai_agents(id) on delete restrict,
  initiated_by uuid references public.primetime_workspace_memberships(id),
  lead_id uuid references public.primetime_leads(id) on delete restrict,
  action_type text not null,
  input_summary text,
  output_summary text,
  status text not null default 'pending' check (status in ('pending','running','awaiting_approval','approved','rejected','completed','failed')),
  requires_approval boolean not null default false,
  approved_by uuid references public.primetime_workspace_memberships(id),
  approved_at timestamptz,
  rejected_by uuid references public.primetime_workspace_memberships(id),
  rejected_at timestamptz,
  rejection_reason text,
  completed_at timestamptz,
  error_message text,
  audit_event_id bigint references public.primetime_audit_events(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
