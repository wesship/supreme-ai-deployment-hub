# Supabase RLS Hardening Phase 1

Related issue: #498

## Scope

This phase removes confirmed production policy drift without changing application table structures.

- Replaces public `allow_all` policies on core Hermes tables with owner/admin policies.
- Removes public service-write policies from observability and plan tables.
- Keeps `service_role` access for trusted backend and Edge Function execution.
- Pins mutable trigger-function search paths.
- Optimizes new policies to evaluate auth functions once per statement.

## Required staging validation

Do not apply to production until all checks pass in staging.

### Identity matrix

Use two ordinary test users in separate workspaces plus one admin test user:

| Actor | Own rows | Other user's rows | Service writes |
|---|---:|---:|---:|
| User A | allowed | denied | denied |
| User B | allowed | denied | denied |
| Admin | allowed | allowed where policy permits | denied from browser |
| service_role backend | allowed | allowed | allowed |
| anon | denied | denied | denied |

### Hermes checks

For each of `hermes_goals`, `hermes_tasks`, `hermes_events`, `hermes_checkpoints`, and `hermes_interrupts`:

1. User A can insert a row with `user_id = auth.uid()`.
2. User A cannot insert a row with User B's ID.
3. User A can select their own rows.
4. User A cannot select User B's rows.
5. User A cannot update or delete User B's rows.
6. Backend service-role workflows continue to create and update orchestration records.

### Service-write checks

From an authenticated browser session, verify inserts are denied for:

- `agent_activity_logs`
- `ai_request_logs`
- `error_logs`
- `tool_call_logs`
- `user_plans`

Then verify the backend or Edge Function service-role path can still write each required table.

### Application checks

Run:

- Backend integration tests
- Supabase migration validation
- Authenticated Playwright audit
- AI chat request and logging flow
- Hermes goal/task execution
- OCC/admin observability reads
- Subscription/plan read flow

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

Expected outcomes:

- No `allow_all` policy remains.
- No non-SELECT policy has `USING (true)` or `WITH CHECK (true)` for public, anon, or authenticated roles.
- Hermes policies explicitly target `authenticated` and scope by `user_id`.
- Observability and plan mutations occur only through `service_role` paths.

## Rollback

If a trusted backend path unexpectedly uses the authenticated role rather than `service_role`, stop promotion and repair that path. Do not restore public `allow_all` policies.

For an emergency staging rollback only, revert the migration database branch or restore the prior staging snapshot. Production promotion must include a tested forward-fix migration rather than reintroducing unrestricted policies.
