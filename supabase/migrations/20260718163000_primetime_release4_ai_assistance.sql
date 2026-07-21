-- PRIMETIME Release 4 — AI Assistance Foundation
-- Governed AI assistance layer for insurance CRM operations.
-- This migration intentionally does not create autonomous execution, product recommendation,
-- quote generation, policy decisioning, or outbound send capabilities.

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  key text not null,
  name text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','retired','disabled')),
  allowed_actions jsonb not null default '[]'::jsonb,
  blocked_actions jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create table if not exists public.ai_agent_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  agent_id uuid not null references public.ai_agents(id) on delete restrict,
  version integer not null check (version > 0),
  system_prompt text not null,
  model_policy jsonb not null default '{}'::jsonb,
  tool_policy jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','retired','disabled')),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (agent_id, version),
  constraint approved_agent_versions_require_reviewer check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table if not exists public.ai_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  requested_by uuid,
  agent_key text not null,
  assigned_agent_version_id uuid references public.ai_agent_versions(id) on delete restrict,
  request_type text not null,
  prompt text not null,
  status text not null default 'requested' check (status in ('requested','processing','draft_ready','review_required','blocked','approved','rejected','closed')),
  person_id uuid references public.primetime_people(id) on delete restrict,
  lead_id uuid references public.primetime_leads(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  communication_id uuid references public.communications(id) on delete restrict,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistance_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid not null references public.ai_assistance_requests(id) on delete restrict,
  output_type text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review_required','approved','rejected','superseded','blocked')),
  agent_id uuid references public.ai_agents(id) on delete restrict,
  agent_version_id uuid references public.ai_agent_versions(id) on delete restrict,
  requires_human_approval boolean not null default true,
  requires_licensed_review boolean not null default false,
  requires_compliance_review boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_action_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid references public.ai_assistance_requests(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  action_type text not null,
  action_status text not null default 'proposed' check (action_status in ('proposed','blocked','approval_required','approved','executed','rejected','failed')),
  target_table text,
  target_id uuid,
  proposed_payload jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  proposed_by uuid,
  blocked_reason text,
  approval_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  review_type text not null check (review_type in ('human','licensed','compliance','manager')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  action_id uuid references public.ai_action_ledger(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  reason text,
  due_at timestamptz,
  requested_by uuid,
  decided_by uuid,
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint decided_approvals_require_reviewer check (status not in ('approved','rejected') or (decided_by is not null and decided_at is not null))
);

create table if not exists public.ai_compliance_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  request_id uuid references public.ai_assistance_requests(id) on delete restrict,
  output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
  action_id uuid references public.ai_action_ledger(id) on delete restrict,
  severity text not null check (severity in ('info','warning','critical','blocked')),
  rule_key text not null,
  finding text not null,
  recommendation text,
  status text not null default 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_citations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
  output_id uuid not null references public.ai_assistance_outputs(id) on delete restrict,
  source_title text not null,
  source_type text not null,
  confidence numeric(4,3) check (confidence is null or (confidence between 0 and 1)),
  source_url text,
  source_version text,
  effective_date date,
  excerpt text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.ai_agents enable row level security;
alter table public.ai_agent_versions enable row level security;
alter table public.ai_assistance_requests enable row level security;
alter table public.ai_assistance_outputs enable row level security;
alter table public.ai_action_ledger enable row level security;
alter table public.ai_approval_requests enable row level security;
alter table public.ai_compliance_findings enable row level security;
alter table public.ai_knowledge_citations enable row level security;

create or replace function public.primetime_block_autonomous_regulated_ai_actions()
returns trigger
language plpgsql
as $$
begin
    if lower(coalesce(new.action_type, '')) in (
        'regulated_recommendation',
        'quote',
        'quote_generation',
        'policy_decision',
        'submit_application',
        'autonomous_send',
        'send_message',
        'place_call',
        'voice_call',
        'delete_record'
    ) then
        new.action_status := 'blocked';
        new.blocked_reason := coalesce(new.blocked_reason, 'Release 4 blocks autonomous regulated, delivery, and delete actions.');
    end if;
    return new;
end;
$$;

drop trigger if exists trg_block_autonomous_regulated_ai_actions on public.ai_action_ledger;
create trigger trg_block_autonomous_regulated_ai_actions
before insert or update on public.ai_action_ledger
for each row execute function public.primetime_block_autonomous_regulated_ai_actions();

create or replace function public.primetime_ai_approval_status_sync()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'approved' and new.decided_at is null then
        new.decided_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists trg_ai_approval_status_sync on public.ai_approval_requests;
create trigger trg_ai_approval_status_sync
before insert or update on public.ai_approval_requests
for each row execute function public.primetime_ai_approval_status_sync();

create or replace function public.primetime_ai_action_audit_event()
returns trigger
language plpgsql
as $$
begin
    insert into public.primetime_audit_events (
        workspace_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) values (
        new.workspace_id,
        new.proposed_by,
        'ai.action.' || new.action_status,
        'ai_action_ledger',
        new.id,
        jsonb_build_object(
            'request_id', new.request_id,
            'output_id', new.output_id,
            'action_type', new.action_type,
            'target_table', new.target_table,
            'blocked_reason', new.blocked_reason
        )
    );
    return new;
end;
$$;

drop trigger if exists trg_ai_action_audit_event on public.ai_action_ledger;
create trigger trg_ai_action_audit_event
after insert on public.ai_action_ledger
for each row execute function public.primetime_ai_action_audit_event();

-- Seed canonical Release 4 agent definitions. These are inactive until approved versions exist.
insert into public.ai_agents (workspace_id, name, key, purpose, blocked_actions)
select w.id, seed.name, seed.agent_key, seed.description, '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb
from public.primetime_workspaces w
cross join (values
    ('Intake Agent', 'intake_agent', 'Drafts intake summaries, duplicate-check suggestions, tags, and review tasks.', false, false),
    ('Follow-Up Agent', 'follow_up_agent', 'Drafts follow-up suggestions, reminders, and next-action recommendations.', false, false),
    ('Scheduling Agent', 'scheduling_agent', 'Suggests appointment times, reminder drafts, and no-show recovery actions.', false, false),
    ('Meeting Prep Agent', 'meeting_prep_agent', 'Creates supervised meeting briefs and disclosure reminders.', true, false),
    ('Compliance Reviewer Agent', 'compliance_reviewer_agent', 'Reviews drafts, templates, consent, suppression, and prohibited language.', false, true)
) as seed(name, agent_key, description, requires_licensed_review, requires_compliance_review)
on conflict (workspace_id, key) do nothing;

create or replace function public.primetime_seed_ai_agents_for_workspace()
returns trigger language plpgsql as $$
begin
  insert into public.ai_agents (workspace_id, name, key, purpose, blocked_actions)
  values
    (new.id, 'Intake Agent', 'intake_agent', 'Drafts intake summaries, duplicate-check suggestions, tags, and review tasks.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Follow-Up Agent', 'follow_up_agent', 'Drafts follow-up suggestions, reminders, and next-action recommendations.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Scheduling Agent', 'scheduling_agent', 'Suggests appointment times, reminder drafts, and no-show recovery actions.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Meeting Prep Agent', 'meeting_prep_agent', 'Creates supervised meeting briefs and disclosure reminders.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb),
    (new.id, 'Compliance Reviewer Agent', 'compliance_reviewer_agent', 'Reviews drafts, templates, consent, suppression, and prohibited language.', '["regulated_recommendation","quote_generation","policy_decision","submit_application","send_message","voice_call","delete_record"]'::jsonb)
  on conflict (workspace_id, key) do nothing;
  return new;
end;
$$;

drop trigger if exists primetime_workspace_seed_ai_agents on public.primetime_workspaces;
create trigger primetime_workspace_seed_ai_agents
after insert on public.primetime_workspaces
for each row execute function public.primetime_seed_ai_agents_for_workspace();

