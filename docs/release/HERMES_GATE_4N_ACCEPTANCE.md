# D3VONN.IO — Hermes Release Candidate Gate 4N Handoff

**Candidate:** PR #1439 (`release/security-performance-rc-20261016`). **Policy:** HOLD; no merge, production promotion, migrations, or live customer access.

## Automated evidence
- Latest pre-handoff candidate commit `d8e12c6b1c411ad763b333ce9b4bdc04daa8c43d`: 27 GitHub workflow successes, no pending/failures.
- Hermes Production Certification, Lighthouse, Vercel and Snyk succeeded.
- Those workflows do **not** count as authenticated two-account isolation certification.

## Protected staging certification prerequisites
- Dedicated **nonproduction** deployment containing the exact candidate commit. Record deployment URL and SHA.
- GitHub environment `hermes-staging-certification` configured with required reviewers and restrictions.
- Secrets: `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_API_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_EMAIL_B`, `E2E_TEST_PASSWORD_B`, `HERMES_TEST_CORRELATION_ID_A`.
- Staging-only identities A and B, with an existing synthetic task associated with A. Never paste tokens or passwords into PR or logs.
- Workflow `.github/workflows/hermes-two-account-staging.yml` is `workflow_dispatch` only. Workflow must be activated through a reviewed, safe mechanism on GitHub's default branch before it can be manually dispatched. Do not merge the combined application release solely to activate testing.

## Required execution record
1. Record exact staging API deployment SHA and this test workflow SHA.
2. Under protected environment approval, run `HERMES_STAGING_CERTIFY=1 python -m pytest -q backend/tests/test_hermes_staging_two_account.py -rs` on a properly restricted staging runner.
3. Capture redacted logs proving A receives HTTP 200 for its own stream, B receives HTTP 403/404, B receives no SSE data. Do not include authorization headers or tokens.
4. Independently verify session expiry/revocation under an open SSE connection, task-owner boundary, correlation filtering and cross-account denial.
5. Attach evidence and reviewer approval to PR #1439.

## Further release checks
- Desktop and mobile screenshots plus Lighthouse against the exact combined release SHA; verify 3D background still renders after idle.
- Independent security review of `backend/app/routers/hermes_event_stream.py`, authorization tests, and continuous auth-call performance overhead.
- Document previous healthy deployment ID, rollback procedure, verification endpoints and expected smoke-test outcomes. Explicit go/no-go decision is required.

**Fail-closed condition:** If any credential, staging task, authenticated test evidence, independent approval, visual test, or rollback plan is absent, keep PR in draft and do not promote.
