# CI/CD Audit Refresh Specification

Status: Ready for implementation
Owner: Wesley Little
Tracking: #624

## Objective

Refresh the checked-in GitHub Actions audit reports from current `main` and prevent future stale-report drift without changing, deleting, renaming, or consolidating any workflow.

## Current evidence

The repository contains audit tooling under `scripts/workflow-audit/` and checked-in reports under `scripts/workflow-audit/reports/`. The existing `inventory.tsv` does not include all newer D3VONN production-certification and operations workflows now present on `main`, so it cannot be used as the authoritative consolidation baseline.

## Required implementation

1. Run the existing workflow-audit tooling against every `.github/workflows/*.yml` and `.yaml` file on current `main`.
2. Regenerate at minimum:
   - `inventory.tsv`
   - `risk-score.tsv`
   - `permissions-audit.tsv`
   - dead-path report
   - workflow fingerprints
3. Extend the inventory schema to include:
   - workflow display name
   - workflow filename
   - job IDs and emitted job/check names
   - triggers and path filters
   - schedule expressions
   - concurrency group and cancellation policy
   - environment names
   - top-level and job-level permissions
   - reusable-workflow calls
   - artifact names and retention days
   - referenced secret names only, never values
   - mutation capability classification
   - owner, purpose, risk, and proposed disposition
4. Add a deterministic stale-report check that fails only when generated metadata differs from the checked-in reports.
5. Make the stale-report check runnable locally and in CI.
6. Do not alter workflow behavior in this change.

## Required-check boundary

This phase must not:

- delete or rename workflow files or jobs;
- modify branch protection or rulesets;
- alter required status checks;
- change deployment or promotion behavior;
- change secrets, environments, credentials, or production configuration.

## Acceptance criteria

- Every workflow file on `main` appears exactly once in the refreshed inventory.
- New D3VONN audit, certification, performance, contact, AI, and operations workflows are represented.
- Inventory generation is deterministic across two consecutive clean runs.
- Secret values are never read or printed.
- A stale checked-in report causes a clear CI failure with regeneration instructions.
- No production or workflow behavior changes are included.

## Follow-on

After this report refresh is merged, export live GitHub rulesets and branch-protection required status contexts and populate `CI_CD_REQUIRED_CHECK_MAP_PENDING.md` before any consolidation proposal.