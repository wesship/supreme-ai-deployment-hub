# Supabase RLS Phase 2A Validation Runbook

Related issue: #504

Migration: `20260722233500_supabase_rls_phase2a_backend_only.sql`

## Safety boundary

- Apply only to a new isolated Supabase development branch first.
- Do not apply directly to production.
- Do not merge the Supabase branch into production without separate explicit approval.
- The active `approval_queue` and `rag_documents` tables are intentionally outside this migration.

## 1. Preflight

Confirm the branch is healthy and record its project ref. Verify the target migration is the only unapplied Phase 2A migration.

Record the target tables that exist:

```sql
with targets(name) as (
  values
    ('ai_action_ledger'),
    ('ai_approval_requests'),
    ('ai_assistance_requests'),
    ('ai_assistance_outputs'),
    ('ai_compliance_findings'),
    ('ai_agents'),
    ('ai_agent_versions'),
    ('approval_requests'),
    ('rag_document_logs'),
    ('primetime_workspaces'),
    ('primetime_workspace_memberships'),
    ('primetime_roles'),
    ('primetime_people'),
    ('primetime_households'),
    ('primetime_household_members'),
    ('primetime_leads'),
    ('primetime_tasks'),
    ('primetime_activities'),
    ('primetime_ai_actions'),
    ('primetime_ai_agents'),
    ('primetime_audit_events'),
    ('primetime_consent_records'),
    ('primetime_suppression_records'),
    ('primetime_release_exceptions')
)
select name, to_regclass(format('public.%I', name)) is not null as exists
from targets
order by name;
```

## 2. Apply migration

Apply the Phase 2A migration to the isolated branch. A failure must stop the rollout; do not partially reproduce the statements manually.

## 3. Verify RLS and explicit deny policies

Every existing target table must have RLS enabled and exactly one policy named `Deny direct browser access` for `anon` and `authenticated`.

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  p.policyname,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in (
    'ai_action_ledger', 'ai_approval_requests', 'ai_assistance_requests',
    'ai_assistance_outputs', 'ai_compliance_findings', 'ai_agents',
    'ai_agent_versions', 'approval_requests', 'rag_document_logs',
    'primetime_workspaces', 'primetime_workspace_memberships',
    'primetime_roles', 'primetime_people', 'primetime_households',
    'primetime_household_members', 'primetime_leads', 'primetime_tasks',
    'primetime_activities', 'primetime_ai_actions', 'primetime_ai_agents',
    'primetime_audit_events', 'primetime_consent_records',
    'primetime_suppression_records', 'primetime_release_exceptions'
  )
order by c.relname, p.policyname;
```

Expected:

- `rls_enabled = true`
- policy name is `Deny direct browser access`
- `cmd = ALL`
- `qual = false`
- `with_check = false`

## 4. Verify table privileges

```sql
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'ai_action_ledger', 'ai_approval_requests', 'ai_assistance_requests',
    'ai_assistance_outputs', 'ai_compliance_findings', 'ai_agents',
    'ai_agent_versions', 'approval_requests', 'rag_document_logs',
    'primetime_workspaces', 'primetime_workspace_memberships',
    'primetime_roles', 'primetime_people', 'primetime_households',
    'primetime_household_members', 'primetime_leads', 'primetime_tasks',
    'primetime_activities', 'primetime_ai_actions', 'primetime_ai_agents',
    'primetime_audit_events', 'primetime_consent_records',
    'primetime_suppression_records', 'primetime_release_exceptions'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;
```

Expected:

- no rows for `PUBLIC`, `anon`, or `authenticated`
- `service_role` retains all required table privileges

## 5. Role-behavior probes

Use transactions and roll them back.

### Anonymous and ordinary authenticated users

For one representative existing target table:

```sql
begin;
set local role anon;
select count(*) from public.ai_assistance_requests;
rollback;
```

Expected: permission denied because table privileges were revoked.

Repeat with `authenticated`.

### Service role

```sql
begin;
set local role service_role;
select count(*) from public.ai_assistance_requests;
rollback;
```

Expected: query succeeds.

For a writable target table, perform a schema-valid insert and delete inside a transaction or use a temporary probe row that is removed immediately. Do not leave test data behind.

## 6. Governed API regression tests

Test through the FastAPI boundary with valid users and two separate workspaces:

- workspace member can list or create an AI assistance request in their workspace
- cross-workspace user is denied
- representative can perform only representative-authorized actions
- manager/workspace-admin approval operations succeed
- blocked autonomous actions remain blocked
- audit events are still written through service-role paths
- consent and suppression checks still execute before communications

## 7. Active OCC table regression

Confirm the migration did not change the active tables:

- `approval_queue`
- `rag_documents`

Verify their existing policies and run the OCC approval and RAG metadata read paths. No policy or grant change to these tables is expected from Phase 2A.

## 8. Advisor review

Rerun Supabase Security and Performance Advisors.

Expected security result:

- Phase 2A target tables no longer report `RLS enabled but no policy`
- no new permissive-policy warning
- remaining findings are documented separately

## 9. Promotion report

Before requesting production approval, report:

- branch name and project ref
- migration version
- target tables present and absent
- privilege verification result
- explicit deny-policy verification result
- anonymous/authenticated denial result
- service-role read/write result
- governed API regression result
- active OCC table regression result
- Security and Performance Advisor results
- rollback plan
