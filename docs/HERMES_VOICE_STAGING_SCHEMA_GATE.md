# Hermes Voice — Staging Session Schema Gate

Staging Supabase project: `ypomzwhtaamxdmcwtpyf` (Supreme_ai_deployment_hub_staging).

Applied via Supabase migration API: `hermes_voice_sessions_staging_owner_read`.

## Applied SQL

```sql
create table if not exists public.hermes_voice_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '5 minutes'),
 revoked_at timestamptz,
 constraint voice_session_lifetime check (expires_at > created_at and expires_at <= created_at + interval '5 minutes')
);
create index if not exists hermes_voice_sessions_owner_active_idx on public.hermes_voice_sessions (user_id, expires_at) where revoked_at is null;
alter table public.hermes_voice_sessions enable row level security;
revoke all on public.hermes_voice_sessions from anon;
grant select on public.hermes_voice_sessions to authenticated;
create policy "voice sessions owner read" on public.hermes_voice_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
```

## Verification

A read of `pg_class.relrowsecurity` for `public.hermes_voice_sessions` returned `true`.

## Remaining blockers

- Table is deliberately read-only to normal authenticated clients; server-controlled issuance and revocation are not yet implemented.
- No token or provider credential issuance is active.
- No proof yet for per-user concurrency enforcement, user-isolation integration tests or load tests.
- Security advisor findings exist elsewhere in staging and need separate triage; do not treat this migration as a clean global security audit.
- No production migration or deployment approved.

Release: HOLD.
