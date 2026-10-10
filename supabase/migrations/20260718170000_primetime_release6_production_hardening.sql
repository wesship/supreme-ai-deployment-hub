-- PRIMETIME Release 6: Production Hardening
-- Canonical tables: compliance_rules, release_gates, data_quality_exceptions,
--                   system_health_events
-- Purpose: enforce non-negotiable rules at the database layer, record
--          release gate evidence, and track data quality exceptions.

begin;

-- ────────────────────────────────────────────────────────────
-- Compliance rules registry (non-negotiable rule definitions)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_compliance_rules (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text not null,
  severity        text not null check (severity in ('critical','high','medium','low')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Seed the non-negotiable rules from the canonical architecture
insert into public.primetime_compliance_rules (code, name, description, severity) values
  ('NO_LEAD_WITHOUT_OWNER',         'No lead without owner',                'Every lead must have an assigned owner member',                                      'critical'),
  ('NO_OPEN_OPP_WITHOUT_NEXT_ACTION','No open opportunity without next action','Every open lead must have a next action and deadline',                            'critical'),
  ('NO_COMM_WITHOUT_CONSENT',       'No communication without consent check','Outbound communications require consent_verified=true',                             'critical'),
  ('NO_AI_WITHOUT_AUDIT',           'No AI execution without audit record',  'Completed AI actions must reference an audit_event_id',                             'critical'),
  ('NO_REGULATED_REC_WITHOUT_HUMAN','No regulated recommendation without licensed human','AI may not independently recommend insurance products or determine suitability','critical'),
  ('NO_STATE_ONLY_IN_N8N',          'No business-critical state only in n8n','n8n must not be the source of truth for consent, lead state, or audit history',    'high'),
  ('NO_UNAPPROVED_TEMPLATE',        'No unapproved template in production',  'Only approved template versions may be used for outbound communications',           'high'),
  ('NO_EXPIRED_KNOWLEDGE_SOURCE',   'No knowledge response from expired source','RAG responses must cite only approved, non-expired knowledge sources',           'high'),
  ('NO_SENSITIVE_EXPORT_WITHOUT_AUTH','No sensitive export without authorization','Exports of PII or regulated data require explicit authorization and audit log', 'high')
on conflict (code) do nothing;

-- ────────────────────────────────────────────────────────────
-- Release gates (evidence record for each release exit gate)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_release_gates (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  release_number  integer not null check (release_number between 1 and 10),
  gate_code       text not null,
  status          text not null default 'pending'
                    check (status in ('pending','passing','failing','waived')),
  evidence        text,
  verified_by     uuid references public.primetime_workspace_memberships(id),
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, release_number, gate_code)
);

-- ────────────────────────────────────────────────────────────
-- Data quality exceptions (records that fail exit gate checks)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_data_quality_exceptions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.primetime_workspaces(id) on delete restrict,
  rule_code       text not null references public.primetime_compliance_rules(code),
  record_type     text not null,
  record_id       uuid not null,
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.primetime_workspace_memberships(id),
  resolution_note text,
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- System health events (deployment, migration, rollback events)
-- ────────────────────────────────────────────────────────────
create table if not exists public.primetime_system_health_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.primetime_workspaces(id) on delete restrict,
  event_type      text not null check (event_type in (
                    'migration_applied',
                    'migration_rolled_back',
                    'deployment',
                    'rollback',
                    'health_check_pass',
                    'health_check_fail',
                    'release_gate_pass',
                    'release_gate_fail'
                  )),
  description     text not null,
  metadata        jsonb not null default '{}',
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
create index if not exists primetime_release_gates_workspace_release_idx
  on public.primetime_release_gates(workspace_id, release_number);
create index if not exists primetime_dq_exceptions_workspace_rule_idx
  on public.primetime_data_quality_exceptions(workspace_id, rule_code, detected_at desc);
create index if not exists primetime_dq_exceptions_unresolved_idx
  on public.primetime_data_quality_exceptions(workspace_id, detected_at desc)
  where resolved_at is null;
create index if not exists primetime_health_events_occurred_idx
  on public.primetime_system_health_events(occurred_at desc);

-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────
-- primetime_compliance_rules: global reference table, no RLS needed
alter table public.primetime_release_gates enable row level security;
alter table public.primetime_data_quality_exceptions enable row level security;
alter table public.primetime_system_health_events enable row level security;

-- ────────────────────────────────────────────────────────────
-- Enforcement: release gates are append-only (no deletion)
-- ────────────────────────────────────────────────────────────
create or replace function public.primetime_prevent_release_gate_deletion()
returns trigger language plpgsql as $$
begin
  raise exception 'primetime: release gate records cannot be deleted — update status instead';
end;
$$;

create trigger primetime_release_gates_no_delete
  before delete on public.primetime_release_gates
  for each row execute function public.primetime_prevent_release_gate_deletion();

-- ────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────
create trigger primetime_compliance_rules_updated_at
  before update on public.primetime_compliance_rules
  for each row execute function public.primetime_touch_updated_at();

create trigger primetime_release_gates_updated_at
  before update on public.primetime_release_gates
  for each row execute function public.primetime_touch_updated_at();

-- ────────────────────────────────────────────────────────────
-- Record this migration as a system health event
-- ────────────────────────────────────────────────────────────
insert into public.primetime_system_health_events (event_type, description, metadata)
values (
  'migration_applied',
  'PRIMETIME Release 6 production hardening migration applied',
  '{"release": 6, "migration": "20260718170000_primetime_release6_production_hardening"}'
);

commit;
