# Supabase RLS Phase 2A Validation Runbook

Related issue: #504

Migration: `20260722233500_supabase_rls_phase2a_backend_only.sql`

## Safety boundary

- Apply only to a new isolated Supabase development branch first.
- Do not apply directly to production.
- Do not merge the Supabase branch into production without separate explicit approval.
- Phase 2A covers only tables reproducible from repository migrations.
- Production-only `approval_requests` and `rag_document_logs` are deferred to schema-drift remediation.
- Active `approval_queue` and `rag_documents` are intentionally outside this migration.

## 1. Preflight

Confirm the branch is healthy and record its project ref. Verify all 22 Phase 2A targets exist:

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

A missing Phase 2A target is a blocker. Production-only drift tables are not Phase 2A targets.

## 2. Apply migration

Apply the Phase 2A migration to the isolated branch. A failure must stop the rollout; do not partially reproduce statements manually.

## 3. Verify RLS and explicit deny policies

Every Phase 2A target must have RLS enabled and exactly one policy named `Deny direct browser access` for `anon` and `authenticated`.

Expected:

- `rls_enabled = true`
- policy count is `1`
- policy name is `Deny direct browser access`
- `cmd = ALL`
- `qual = false`
- `with_check = false`

## 4. Verify table privileges

For every Phase 2A target:

- `PUBLIC` has no table privileges.
- `anon` has no table privileges.
- `authenticated` has no table privileges.
- `service_role` retains required `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges.

## 5. Role-behavior probes

Use transactions and roll them back.

### Anonymous

```sql
begin;
set local role anon;
select count(*) from public.primetime_roles;
rollback;
```

Expected: PostgreSQL permission denied.

### Ordinary authenticated

```sql
begin;
set local role authenticated;
select count(*) from public.primetime_roles;
rollback;
```

Expected: PostgreSQL permission denied.

### Service role read/write

```sql
begin;
set local role service_role;
insert into public.primetime_roles (code, name, description)
values ('__phase2a_probe__', 'Phase 2A Probe', 'temporary staging validation');
update public.primetime_roles
set description = 'updated staging validation'
where code = '__phase2a_probe__';
delete from public.primetime_roles where code = '__phase2a_probe__';
rollback;
```

Expected: every statement succeeds and zero probe rows remain.

## 6. Governed API regression tests

Test through the FastAPI boundary with valid users and two separate workspaces:

- workspace member can list or create an AI assistance request in their workspace
- cross-workspace user is denied
- representative can perform only representative-authorized actions
- manager/workspace-admin approval operations succeed
- blocked autonomous actions remain blocked
- audit events are still written through service-role paths
- consent and suppression checks still execute before communications

## 7. Production schema-drift check

Confirm these production-only tables are absent from the branch and absent from the Phase 2A migration:

- `approval_requests`
- `rag_document_logs`
- `approval_queue`
- `rag_documents`

The first two require a separate append-only schema-capture and hardening migration. The active OCC tables remain excluded.

## 8. Advisor review

Rerun Supabase Security and Performance Advisors.

Expected security result:

- none of the 22 Phase 2A targets report `RLS enabled but no policy`
- no new permissive-policy warning
- remaining findings are documented separately

Performance findings are tracked separately and do not expand Phase 2A scope.

## 9. Promotion report

Before requesting production approval, report:

- branch name and project ref
- migration version and exact GitHub head SHA
- all 22 target tables present
- privilege verification result
- explicit deny-policy verification result
- anonymous/authenticated denial result
- service-role read/write result
- governed API regression result
- production schema-drift exclusions
- Security and Performance Advisor results
- rollback plan
