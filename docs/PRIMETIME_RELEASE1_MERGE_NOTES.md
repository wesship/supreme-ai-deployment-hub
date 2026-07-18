# PRIMETIME Release 1 Merge Notes

## Current branch state

Branch: `feat/primetime-command-engine`

This branch contains PRIMETIME Command Engine, Concept Intelligence Engine foundation, production blueprint, and Release 1 governed CRM foundation work.

The prior pull request #236 was closed without merge. The branch remains ahead of `main`, but it has diverged and must be reconciled with current `main` before production merge.

## Important merge warning

As of the Release 1 schema commit, the branch is significantly behind current `main`. Do not mark the next PR ready for review until the branch is rebased or the changes are recreated on top of latest `main`.

## Recommended reconciliation path

1. Create a fresh branch from latest `main`.
2. Cherry-pick or manually reapply the PRIMETIME files in logical batches:
   - Production blueprint and release gates
   - Command Engine package
   - Concept Intelligence package
   - Command governance migrations
   - Release 1 CRM foundation migrations
   - Command Console UI
   - Backend command routes
3. Run the complete CI suite.
4. Verify no existing current-main modules are overwritten.
5. Apply Supabase migrations in a staging database.
6. Promote the PR from draft only after migration and route tests pass.

## High-risk files to review carefully

- `src/App.tsx`
- `backend/intelligence/api_router.py`
- `backend/intelligence/plan_api.py`
- `backend/intelligence/plan_api2.py`
- `packages/primetime-command-engine/src/routing2.ts`

## Temporary cleanup before final merge

- Remove unused route shells.
- Rename `routing2.ts` to `routing.ts`.
- Mirror `CONCEPT-*` commands into backend parser.
- Register only one command planning router.
- Apply Release 1 migration tests against a real Postgres/Supabase instance.

## Release 1 files added

- `supabase/migrations/20260616023000_primetime_release1_crm_foundation.sql`
- `supabase/migrations/20260616024500_primetime_release1_enforcement.sql`
- `docs/PRIMETIME_RELEASE1_ENGINEERING_PLAN.md`
- `backend/tests/test_primetime_release1_schema_static.py`
