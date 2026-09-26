# Wearable Event Ledger Gate

The staging ledger gate is now closed for `Supreme_ai_deployment_hub_staging`.

## Certified staging state

Migration `20260926195220_wearable_event_ledger_staging` created `public.wearable_events` with:

- globally unique `event_id` for idempotent retry handling
- canonical event/source/privacy/audit fields used by the FastAPI ingress
- JSON-object payload storage with SHA-256 payload hashing
- bounded capability count and field-length constraints
- forced RLS
- no table privileges for `PUBLIC`, `anon`, or `authenticated`
- explicit `service_role` authority and service-role-only policy
- indexes for user/time, device/time, correlation, and trace lookup
- explicit table/column documentation prohibiting raw media persistence

A transaction-scoped duplicate smoke test inserted the same `event_id` twice with `ON CONFLICT DO NOTHING`; the ledger contained exactly one row before rollback.

The Supabase security advisor does not report `wearable_events` as an RLS or access finding. Existing advisor findings are on unrelated pre-existing tables/functions and are outside this wearable gate.

## Activation sequence

With the staging schema/access gate certified, the API v1 composition root may now register the wearable router. Production promotion is still blocked until:

1. fresh CI passes for router registration and ingress tests
2. authenticated staging HTTP smoke test succeeds against `POST /api/v1/vision/events`
3. duplicate retry returns `already_processed`
4. consent denial and malformed capability paths are verified over HTTP
5. no raw-media persistence is observed
6. the migration is promoted through the protected production migration workflow
7. XREAL physical-device transport remains disabled until hardware-in-the-loop certification

Production is not implied by staging certification.
