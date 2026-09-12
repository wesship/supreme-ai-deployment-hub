# Gate 17 — Policy Promotion / Change Request

Gate 17 introduces a durable, non-executing change-request object between a human-approved routing recommendation and any future runtime policy change.

## Contract

A change request may only be created from an existing `approved` row in `public.ai_film_routing_recommendation_approvals`. The database insert policy verifies the linked approval belongs to the same owner and that its recommendation key and evidence hash exactly match the request.

Each request records:

- approval ID and immutable recommendation evidence hash;
- provider and optional visual-style scope;
- recommendation action and bounded `-5..+5` proposed adjustment;
- structured proposed runtime delta;
- mandatory rollback plan;
- provider canary prerequisite (`pass_required` for non-baseline providers, `not_required` for the Pollo baseline contract);
- `second_review_required = true`;
- initial and only browser-writable status `pending_second_review`;
- requestor and creation timestamp.

## Security boundary

`public.ai_film_policy_promotion_change_requests` has RLS enabled. Anonymous access is revoked. Authenticated clients receive only `SELECT` and `INSERT`; there is no browser `UPDATE` or `DELETE` grant and no update/delete policy.

The insert policy derives owner/requestor identity from the active Supabase session and rejects requests that are not linked to an approved recommendation with the same evidence fingerprint.

Gate 17 does **not**:

- apply a routing adjustment;
- change provider configuration;
- change activation/canary flags;
- enqueue a generation job;
- run a provider canary;
- spend provider credits;
- mark a request as promoted;
- provide a second-review approval action.

The second reviewer and protected promotion executor remain separate future gates.

## Runtime helper

`backend/ai_films/policy_change_request.py` provides a deterministic server-side contract builder. It rejects non-approved evidence, requires a rollback plan, enforces the `-5..+5` recommendation bound, marks non-baseline providers as requiring a canary pass, and always returns `pending_second_review` with `second_review_required = true`.

## Staging verification

The migration was applied only to `Supreme_ai_deployment_hub_staging`. RLS is enabled and only SELECT/INSERT policy commands exist for the new table. Supabase security advisors reported no new Gate 17 finding; existing unrelated advisor findings remain unchanged.
