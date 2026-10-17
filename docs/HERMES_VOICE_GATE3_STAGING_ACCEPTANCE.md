# Hermes voice session staging verification — Gate 3

## Observed on connected staging (2026-10-16)

Project: Supreme_ai_deployment_hub_staging. A public `hermes_voice_sessions` table exists with `id`, `user_id`, `created_at`, `expires_at`, `revoked_at`. A SELECT policy for authenticated users requires `auth.uid() = user_id`.

The existing `hermes-voice-session` Edge Function authenticates users but intentionally responds with HTTP 503 and `voiceEnabled: false`. **Do not change it to issue sessions until all gates below pass.**

## Required acceptance checks

1. Confirm the exact target staging project and inspect all table grants, RLS settings, policies, constraints, indexes, and functions before making schema changes.
2. Define a transactional, database-enforced issuance path (including concurrent requests) limiting users to two unexpired, unrevoked sessions. No client-controlled user ID or TTL.
3. Ensure only trusted server code can insert, revoke, or refresh sessions. Browser users must not be able to change ownership or expiry. Never ship a service-role credential to the client.
4. Issue opaque, unpredictable session IDs only after authenticated identity checks. Limit validity to five minutes; return no provider secrets.
5. Validate ownership, expiry, and revocation against the database for **every privileged Hermes action**, not just at initial issuance. Treat missing rows and database errors as denial.
6. Add user-initiated revocation, idle/timeout expiry, and a reliable cleanup path. Verify logout/revocation behavior.
7. Exercise concurrent issuance, expired/revoked/unknown sessions, two different accounts, cross-account event injection, unauthenticated calls, malformed payloads, and unauthorized tool execution.
8. Run staging integration tests, security advisors, CI, and rendered browser QA. Capture logs/evidence and get explicit approval before any rollout.

## Current release decision

**HOLD.** Table presence and owner-read RLS are not evidence of a complete issuance/revocation path. Keep the existing fail-closed endpoint and feature flag disabled.
