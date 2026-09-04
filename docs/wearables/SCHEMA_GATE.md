# Wearable Event Ledger Gate

The reconciled wearable runtime intentionally does not register its API router or ship a database migration until the staging schema and access model are certified.

Required before activation:

- create `public.wearable_events` in staging through a reviewed migration
- keep raw media out of the ledger; persist references/derived metadata only
- enable RLS
- explicitly classify Data API grants for `anon`, `authenticated`, and `service_role`
- preserve authenticated ownership semantics and service-role-only persistence unless a narrower client use case is approved
- verify duplicate `event_id` handling and payload hashing
- run Supabase security advisor and access tests in staging
- only then register the wearable router and promote through the protected production migration workflow

The feature remains disabled/inert until this gate is closed.
