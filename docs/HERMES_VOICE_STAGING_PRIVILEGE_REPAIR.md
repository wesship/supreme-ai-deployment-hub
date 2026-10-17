# Hermes voice session privilege repair — staging

Project: Supreme_ai_deployment_hub_staging (`ypomzwhtaamxdmcwtpyf`).

During the next security gate, an inspection of `information_schema.role_table_grants` found that the `authenticated` role still had INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES privileges on `public.hermes_voice_sessions`, despite the earlier intent to expose only owner-scoped reads.

Applied to staging:

```sql
revoke all privileges on table public.hermes_voice_sessions from authenticated, anon;
grant select on table public.hermes_voice_sessions to authenticated;
```

Follow-up privilege query confirmed only `authenticated / SELECT` remains, with no `anon` grants in the inspected set. The earlier owner-only SELECT RLS policy remains the intended access boundary.

This is **not** a completed voice-session implementation. No server-issued session tokens, atomic quota enforcement, revocation endpoint, two-account live tests or Hermes execution are enabled. A service-role writer must be separately reviewed and tested; never put service-role credentials in the browser.

Release remains HOLD.
