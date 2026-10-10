# Supabase RLS Hardening Phase 1

Related issue: #498

## Confirmed live schema

The five core Hermes tables do not contain `user_id` or workspace ownership columns. The Operator Command Center reads them directly from Supabase as an administrative observability view. They are therefore classified as:

- browser: authenticated admin read-only
- anon: no access
- ordinary authenticated users: no access
- trusted backend and Edge Functions: full `service_role` access

This model was applied successfully on isolated Supabase branch `rls-hardening-phase1` (`ehghjbphaxkkgpptidbw`). Production was not changed.

## Scope

- Removes every existing Hermes policy, including public `allow_all` drift.
- Revokes browser writes to the five Hermes tables.
- Creates one admin-only `SELECT` policy per Hermes table using the existing JWT role claim.
- Preserves `service_role` access.
- Removes public service-write policies from observability and plan tables when those tables exist.
- Pins mutable trigger-function search paths when those functions exist.
- Handles schema differences idempotently.

## Required staging validation

### Access matrix

| Actor | Hermes read | Hermes write | Service-table write |
|---|---:|---:|---:|
| anon | denied | denied | denied |
| ordinary authenticated user | denied | denied | denied |
| authenticated admin | allowed | denied | denied from browser |
| service_role backend | allowed | allowed | allowed |

### Hermes checks

For each of `hermes_goals`, `hermes_tasks`, `hermes_events`, `hermes_checkpoints`, and `hermes_interrupts`:

1. Anonymous `SELECT`, `INSERT`, `UPDATE`, and `DELETE` are denied.
2. Ordinary authenticated `SELECT`, `INSERT`, `UPDATE`, and `DELETE` are denied.
3. An authenticated JWT with `role=admin` can select.
4. The admin browser cannot insert, update, or delete.
5. Backend `service_role` orchestration can create and update records.
6. OCC Hermes renders for an administrator and does not expose data to non-admin accounts.

### Service-write checks

Where these tables exist, authenticated browser inserts must be denied:

- `agent_activity_logs`
- `ai_request_logs`
- `error_logs`
- `tool_call_logs`
- `user_plans`

Backend or Edge Function `service_role` writes must continue to succeed.

## Policy verification query

```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'hermes_goals', 'hermes_tasks', 'hermes_events',
    'hermes_checkpoints', 'hermes_interrupts',
    'agent_activity_logs', 'ai_request_logs', 'error_logs',
    'tool_call_logs', 'user_plans'
  )
order by tablename, policyname;
```

Expected Hermes result:

- Exactly one `SELECT` policy per table.
- Policy role is `authenticated`.
- Policy condition requires `(auth.jwt()->>'role') = 'admin'`.
- No `allow_all`, owner, insert, update, or delete browser policy remains.

## Promotion boundary

Do not merge the Supabase development branch into production until:

- repository CI is green
- OCC admin-read behavior is verified
- ordinary user denial is verified
- service-role Hermes execution is verified
- security advisors are rerun
- production promotion receives separate explicit approval

## Rollback

For staging, reset or delete the development branch. Do not restore public `allow_all` policies. Production rollback must use a tested forward-fix migration or a database recovery procedure approved before promotion.
