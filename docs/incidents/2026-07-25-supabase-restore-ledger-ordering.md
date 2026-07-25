# Supabase restore replay ledger-ordering incident — 2026-07-25

## Status

Open launch blocker tracked in Issue #578.

## Confirmed findings

1. Fresh branch replay originally failed at production migration `20260723054414_phase2_explicit_backend_boundaries` because `public.user_plan_logs` did not exist.
2. PR #579 added an idempotent restore migration in Git at `20260723055000_restore_user_plan_logs.sql`.
3. Applying that migration to production registered it later in the Supabase ledger as `20260725220526_restore_user_plan_logs`, so clean branch replay still encountered `20260723054414` first.
4. The production migration-ledger statement for `20260723054414` was therefore guardedly updated to prepend the idempotent `user_plan_logs` restore. Live production schema objects were unchanged.
5. A new disposable branch then replayed through `20260723054414` successfully.
6. The next clean-replay failure is now `relation "public.ai_request_logs" does not exist`, immediately after `20260723054414`, with the next production migration expected at `20260723055343_optimize_rls_policies`.

## Safety actions

- All disposable branches were deleted immediately after evidence collection.
- Production application data was not modified.
- The only production change beyond the already-approved idempotent migration was a guarded correction to the stored replay statement for migration `20260723054414`.

## Acceptance remains blocked

Do not mark the database restore gate complete until a fresh branch replays every production migration, schema/RLS/grants are compared, security advisors show no new errors, and the branch is deleted.
