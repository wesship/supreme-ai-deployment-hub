# D3VONN Beta QA Agent v1

## Purpose

The Beta QA Agent is a bounded production canary for controlled beta operations. It reuses the certified Playwright authentication suite, verifies public web/API health, and creates a GitHub issue only when a real failure is detected.

## What it tests

- Public homepage availability.
- Branded API `/health`, `/health/ready`, and `/health/live` responses.
- Anonymous redirect protection for `/app`.
- Login surface availability.
- Restricted beta identity authentication.
- Core authenticated routes: `/app`, `/dashboard`, `/agents`, `/workflows`, `/voice-studio`, and `/security/ops`.

Production Chat/RAG remains covered by the protected AI certification workflow. This v1 agent deliberately avoids repeating paid AI calls every day.

## Safety boundaries

- Runs in the protected GitHub `production` environment.
- Uses only the dedicated `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` secrets.
- Does not print credentials.
- Disables Playwright traces.
- Does not upload screenshots, test artifacts, or user content.
- Performs no external publication, payment, messaging, destructive database mutation, or provider-credit-heavy action.
- Uses one concurrent run and cancels superseded attempts.

## Schedule and manual operation

The workflow runs daily and can also be started manually:

1. Open GitHub Actions.
2. Select **D3VONN Beta QA Agent**.
3. Choose **Run workflow**.
4. Keep the target at `https://d3vonn.io` for production beta verification.
5. Leave issue creation enabled unless performing a non-production diagnostic run.

## Failure behavior

When health or authenticated journeys fail, the agent:

1. writes a secret-free job summary;
2. opens or updates `Beta QA Agent: production canary failure`;
3. links the exact run and commit;
4. fails the workflow so the incident remains visible.

It does not create duplicate open issues for repeated failures. A later failure is appended to the existing issue.

## Operator response

1. Confirm whether the failure is reproducible.
2. Check Vercel, Railway, Supabase, and Sentry before modifying production.
3. Identify the exact failing route or test.
4. Apply the smallest reversible repair through a reviewed PR.
5. Rerun the Beta QA Agent.
6. Close the failure issue only after a clean run.

## v2 candidates

- Synthetic contact-form delivery using a dedicated test tag and mailbox verification.
- Bounded Chat quality scoring with strict token and cost caps.
- RAG fixture ingest/retrieve/delete with zero-residue verification.
- Browser performance budgets and accessibility checks.
- Tester cohort analytics and feature-flag-aware journeys.
