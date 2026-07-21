-- PRIMETIME Release 4 — AI Assistance Foundation
-- Reconciled to the canonical primetime_* Release 1 base schema; production had not applied the superseded migration.
-- Governed AI assistance layer for insurance CRM operations.
-- This migration intentionally does not create autonomous execution, product recommendation,
-- quote generation, policy decisioning, or outbound send capabilities.

create table if not exists public.ai_agents (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    name text not null,
    agent_key text not null,
    description text,
    release_scope text not null default 'release_4',
    status text not null default 'draft' check (status in ('draft', 'active', 'disabled', 'archived')),
    allowed_actions jsonb not null default '[]'::jsonb,
    blocked_actions jsonb not null default '["regulated_recommendation", "quote", "policy_decision", "autonomous_send", "delete_record"]'::jsonb,
    requires_human_approval boolean not null default true,
    requires_licensed_review boolean not null default false,
    requires_compliance_review boolean not null default false,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, agent_key)
);

create table if not exists public.ai_agent_versions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    agent_id uuid not null references public.ai_agents(id) on delete restrict,
    version_number integer not null,
    prompt text not null,
    tool_policy jsonb not null default '{}'::jsonb,
    model_policy jsonb not null default '{}'::jsonb,
    evaluation_policy jsonb not null default '{}'::jsonb,
    status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
    approved_by uuid,
    approved_at timestamptz,
    created_by uuid,
    created_at timestamptz not null default now(),
    unique (agent_id, version_number),
    constraint approved_agent_versions_require_reviewer check (
        status <> 'approved' or (approved_by is not null and approved_at is not null)
    )
);

create table if not exists public.ai_assistance_requests (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    requested_by uuid,
    agent_id uuid references public.ai_agents(id) on delete restrict,
    agent_version_id uuid references public.ai_agent_versions(id) on delete restrict,
    request_type text not null check (request_type in ('intake', 'follow_up', 'scheduling', 'meeting_prep', 'compliance_review', 'knowledge_answer', 'manager_insight')),
    target_type text not null check (target_type in ('workspace', 'person', 'household', 'lead', 'task', 'appointment', 'communication', 'template', 'policy_check')),
    target_id uuid,
    user_instruction text not null,
    context_summary text,
    status text not null default 'queued' check (status in ('queued', 'running', 'draft_ready', 'approval_required', 'approved', 'rejected', 'blocked', 'failed')),
    risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'regulated')),
    requires_human_approval boolean not null default true,
    requires_licensed_review boolean not null default false,
    requires_compliance_review boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistance_outputs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    request_id uuid not null references public.ai_assistance_requests(id) on delete restrict,
    output_type text not null check (output_type in ('summary', 'draft_message', 'task_suggestion', 'schedule_suggestion', 'meeting_brief', 'compliance_findings', 'knowledge_answer', 'manager_insight')),
    content text not null,
    structured_output jsonb not null default '{}'::jsonb,
    confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
    limitations text,
    status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'superseded')),
    created_at timestamptz not null default now()
);

create table if not exists public.ai_action_ledger (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    request_id uuid references public.ai_assistance_requests(id) on delete restrict,
    output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
    actor_type text not null check (actor_type in ('human', 'ai_agent', 'system')),
    actor_id uuid,
    action_type text not null,
    target_type text not null,
    target_id uuid,
    proposed_payload jsonb not null default '{}'::jsonb,
    executed_payload jsonb,
    execution_status text not null default 'proposed' check (execution_status in ('proposed', 'approved', 'executed', 'rejected', 'blocked', 'failed')),
    blocked_reason text,
    approval_id uuid,
    created_at timestamptz not null default now()
);

create table if not exists public.ai_approval_requests (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    request_id uuid not null references public.ai_assistance_requests(id) on delete restrict,
    output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
    action_ledger_id uuid references public.ai_action_ledger(id) on delete restrict,
    approval_type text not null check (approval_type in ('human', 'licensed_review', 'compliance_review', 'manager_review')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    reviewer_id uuid,
    reviewer_role text,
    decision_reason text,
    decided_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    constraint decided_approvals_require_reviewer check (
        status not in ('approved', 'rejected') or (reviewer_id is not null and decided_at is not null)
    )
);

create table if not exists public.ai_compliance_findings (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    request_id uuid references public.ai_assistance_requests(id) on delete restrict,
    output_id uuid references public.ai_assistance_outputs(id) on delete restrict,
    target_type text not null,
    target_id uuid,
    severity text not null check (severity in ('info', 'warning', 'blocker')),
    rule_key text not null,
    finding text not null,
    recommended_action text,
    status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'waived')),
    created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_citations (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.primetime_workspaces(id) on delete restrict,
    output_id uuid not null references public.ai_assistance_outputs(id) on delete restrict,
    source_title text not null,
    source_type text not null,
    source_uri text,
    source_version text,
    jurisdiction text,
    effective_at timestamptz,
    excerpt text,
    confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
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
        'policy_decision',
        'submit_application',
        'autonomous_send',
        'send_message',
        'place_call',
        'delete_record'
    ) then
        new.execution_status := 'blocked';
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
        target_table,
        target_id,
        metadata
    ) values (
        new.workspace_id,
        new.actor_id,
        'ai.action.' || new.execution_status,
        'ai_action_ledger',
        new.id,
        jsonb_build_object(
            'request_id', new.request_id,
            'output_id', new.output_id,
            'action_type', new.action_type,
            'target_type', new.target_type,
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
insert into public.ai_agents (workspace_id, name, agent_key, description, requires_human_approval, requires_licensed_review, requires_compliance_review)
select w.id, seed.name, seed.agent_key, seed.description, true, seed.requires_licensed_review, seed.requires_compliance_review
from public.primetime_workspaces w
cross join (values
    ('Intake Agent', 'intake_agent', 'Drafts intake summaries, duplicate-check suggestions, tags, and review tasks.', false, false),
    ('Follow-Up Agent', 'follow_up_agent', 'Drafts follow-up suggestions, reminders, and next-action recommendations.', false, false),
    ('Scheduling Agent', 'scheduling_agent', 'Suggests appointment times, reminder drafts, and no-show recovery actions.', false, false),
    ('Meeting Prep Agent', 'meeting_prep_agent', 'Creates supervised meeting briefs and disclosure reminders.', true, false),
    ('Compliance Reviewer Agent', 'compliance_reviewer_agent', 'Reviews drafts, templates, consent, suppression, and prohibited language.', false, true)
) as seed(name, agent_key, description, requires_licensed_review, requires_compliance_review)
on conflict (workspace_id, agent_key) do nothing;
