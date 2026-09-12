# AI Films Policy Promotion — Second Review

Gate 18 adds an immutable second-review record for Gate 17 policy-promotion change requests.

## Endpoint

`POST /api/ai-films/policy-promotions/{change_request_id}/reviews`

The caller must provide a normal authenticated Supabase bearer token plus:

```json
{
  "decision": "approved",
  "rationale": "Independent review rationale"
}
```

The browser never receives or submits the backend service-role credential.

## Enforcement

Before a review event can be recorded, the backend:

1. resolves the authenticated reviewer from the caller's Supabase token;
2. loads the change request through backend-only persistence;
3. requires `status = pending_second_review` and `second_review_required = true`;
4. rejects the review if the reviewer is the original requestor;
5. for approval, validates any required provider canary against the live server-side provider activation contract;
6. for rejection, records `canary_state = not_checked` without requiring a canary;
7. records exactly one immutable review per change request.

## Ledger security

`public.ai_film_policy_promotion_reviews` is RLS-enabled. Authenticated browser clients receive SELECT only. Inserts are backend-only; authenticated clients have no INSERT, UPDATE, or DELETE privilege. Owners and reviewers may read review records relevant to them.

## Non-execution boundary

A second-review approval does not apply a routing delta. The endpoint does not change provider configuration, environment variables, activation/canary state, routing scores, workers, jobs, or provider spend. Responses explicitly report `promotion_executed: false` and `routing_changed: false`.

A future promotion-execution gate must separately verify the approved review and implement its own protected rollout and rollback controls.
