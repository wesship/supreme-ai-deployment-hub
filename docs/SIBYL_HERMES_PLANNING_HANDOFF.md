# Astral Sibyl Echo → Hermes planning inbox

This contract accepts one explicitly selected title/summary as a **draft**, not
an executable task. It writes only `hermes_sibyl_planning_drafts`. There is no
queue insertion, model call, execution route, or approval-to-execution bridge.
The dedicated credential is not accepted by other Hermes routes.

## Contract `sibyl-planning-v1`

- `GET /api/hermes/sibyl/v1/capabilities`
- `POST /api/hermes/sibyl/v1/drafts`
- Both require `Authorization: Bearer <dedicated service token>`.
- POST also requires a UUID `Idempotency-Key` matching the body metadata.

```json
{
  "title": "Plan my next step",
  "description": "The one summary I reviewed and chose to share.",
  "metadata": {
    "source": "astral-sibyl-echo",
    "intent": "planning_only",
    "execution_allowed": false,
    "synthetic": false,
    "actor_ref": "<24 lowercase hex characters>",
    "idempotency_key": "<UUID matching the header>"
  }
}
```

Title is at most 120 characters; description at most 4,000. Unknown fields,
execution requests, wrong actors, invalid keys and control characters are
rejected. The actor reference is a server-derived pseudonym: the first 24 hex
characters of SHA-256 of `sibyl:` plus the authenticated Sibyl account UUID.
The receiver pins it in configuration, never trusts arbitrary user identity.

Success (201, including a duplicate) is an object:

```json
{
  "id": "<persisted draft UUID>",
  "contract": "sibyl-planning-v1",
  "duplicate": false,
  "status": "draft",
  "planning_only": true,
  "execution_allowed": false
}
```

The database unique constraint on `(actor_ref, idempotency_key)` arbitrates
concurrent insertions. An exact retry returns the same persisted receipt. Reuse
with changed content returns 409. After a timeout, retry the **same** payload
and key; do not generate a new key because the previous insert may have committed.
Storage/configuration failure returns 503, never a fabricated receipt. Upstream
error bodies, credentials and selected text are not returned in error messages.

## Deployment gate (not executed by this PR)

1. Apply `supabase/migrations/20261002010000_sibyl_planning_drafts.sql` to the
   D3VONN database. RLS is enabled; browser roles have no privileges/policies.
   The service role receives only SELECT/INSERT on this new table.
2. Deploy the backend with its existing Supabase storage configuration and Redis
   rate limiter. Confirm this router is present in `/api/openapi.json`.
3. Install a fresh high-entropy token (at least 32 characters) as
   `HERMES_SIBYL_SERVICE_TOKEN` in the backend and the identical token as
   `HERMES_HANDOFF_TOKEN` in Sibyl's **server** secrets. Do not reuse operator,
   HNF, TinyFish or Supabase service-role credentials. Do not place it in `VITE_*`.
4. Pin `HERMES_SIBYL_ACTOR_REF` on the receiver. Sibyl pins the corresponding
   verified account UUID in `HERMES_HANDOFF_OWNER_USER_ID`.
5. Set Sibyl `HERMES_HANDOFF_URL` to
   `https://api.d3vonn.io/api/hermes/sibyl/v1/drafts`. Verify authenticated
   capabilities match the contract, then enable its contract flag.
6. Run a clearly marked synthetic draft: verify receipt, retry, changed-payload
   conflict, wrong-token/wrong-actor denial, unchanged execution queue, and the
   database role boundaries. Only then enable the reviewed Send button.

Only user-selected summaries are persisted. Journal, vault and Secret Energy
snapshots are not fetched or exported by this endpoint. Drafts remain private
backend records; this contract does not yet provide a user-facing inbox,
retention/deletion UI, automated plan generation or task execution.

## Verification

`python -m pytest backend/tests/test_sibyl_handoff.py
backend/tests/test_hermes_infrastructure.py backend/tests/test_hnf_hermes_bridge.py -q`
(run on one line). Receiver tests exercise the real ASGI router and shared REST
adapter with simulated storage responses. They do not prove a deployed database
migration or live end-to-end delivery; those are deployment acceptance checks.
