# AI Films Role Studio Gate 11 — durable authoring

This PR stacks on Gate 10, which stacks on Gate 9. It adds a service-role-only draft table, one atomic transition RPC, and authenticated FastAPI endpoints for save, test, submit, approve, and publish. The feature flag `AI_FILMS_ROLE_STUDIO_ENABLED` remains off.

## Staging verification

1. Preview and apply the Gate 9 release-table migration first, then preview this draft/RPC migration. Check database lint, table grants, function execute grants, and the `pg_advisory_xact_lock` behavior on two concurrent first saves.
2. Configure `AI_FILMS_ROLE_ATTESTATION_SECRET` server-side. Use three distinct test users: active editor, active reviewer, and owner or active producer/director publisher. A collaborator must be active with a verified `user_id`; invited email alone is insufficient.
3. Save revision 1. Obtain a policy attestation for the exact profile and revision; call `/test` with the token. Submit review and approve with a different user. Publish with a third authorized user.
4. Confirm `GET /api/ai-films/roles/{project_id}/{role_id}/published` returns the same profile, hash and version. Verify the runtime rejects a tampered profile and an out-of-role tool.
5. Repeat with stale revision, changed voice, expired or altered attestation, self-review, self-publish, nonmember, anonymous caller, and `mental_health`. All must fail without inserting a release.
6. Check SQL row privileges directly: no `anon` or `authenticated` table access, and no direct `authenticated` execute grant on the transition function. Review the project owner's ability to invite independent collaborators before enabling the feature.

## Limits

The signed test is a **policy check**. It does not certify likeness consent, source rights, lip sync, rendering, education quality, radio licensing, or clinical safety. A separate human preview and release decision remain necessary. API errors are generic; audit events for role transitions and rollback UI are future work. Do not mark this gate GREEN or enable the feature without a staging end-to-end run and passing CI on the exact commit.

Local tests: `python3 -m unittest discover -s tests/ai_films -p 'test_role_*.py' -v`.

Rollback: unset `AI_FILMS_ROLE_STUDIO_ENABLED` immediately. Preserve tables for audit and investigate before changing grants or dropping data.
