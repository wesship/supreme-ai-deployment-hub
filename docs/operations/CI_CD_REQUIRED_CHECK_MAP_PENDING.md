# CI/CD Required-Check Map — Pending Live Ruleset Export

Status: Observed ownership mapped; authoritative protection source still pending live export.  
Owner: Wesley Little  
Tracking: #624

## Completed evidence

- Workflow inventory and overlap analysis: `CI_CD_WORKFLOW_INVENTORY_2026-07-31.md`
- Deterministic generated metadata: `scripts/workflow-audit/reports/inventory.tsv`
- Observed PR check ownership: `CI_CD_OBSERVED_CHECK_OWNERSHIP_2026-08-01.md`
- Read-only export procedure: `CI_CD_RULESET_EXPORT_RUNBOOK_2026-08-01.md`
- Canonical aggregate gate: `.github/workflows/required-pr-gate.yml`

The observed map identifies the workflow or external integration that emitted each check seen on PR #664. It also identifies overlap clusters and safe consolidation boundaries.

## Remaining blocker

A correct **required**-check map cannot be inferred from workflow filenames, successful runs, mergeability, or administrator merge behavior alone. The final pass must export the active repository rulesets and classic branch-protection metadata for `main`, then map each exact required status context to its workflow file/job or external integration owner.

The connected GitHub surface used for the observed map does not expose live ruleset and branch-protection required-context metadata. Use the read-only export runbook; do not guess.

## Protection boundary

Until the live export is reconciled:

- do not delete or rename workflow files or jobs;
- do not alter required checks, rulesets, or branch protection;
- do not remove either Vercel or Snyk integration based only on duplicate-looking names;
- do not consolidate deployment, promotion, security, signing, rollback, or production-certification workflows;
- treat missing protection-source mappings as technical debt, not permission to remove a check.

## Final map columns

| Required check context | Workflow/integration owner | Job/check | Trigger | Environment | Protection source | Enforcement/bypass | Replacement/disposition |
|---|---|---|---|---|---|---|---|

## Completion criteria

- Every required context maps to exactly one workflow/job or external integration owner.
- No required context is orphaned or permanently stale.
- No critical workflow is removed merely because it is not a required PR context; scheduled, release, deployment, security, and certification responsibilities are classified separately.
- Duplicate external contexts have verified project/organization ownership before cleanup.
- Any rename or consolidation has exact replacement evidence and a reversible rollback plan.

Completion requires zero orphaned required checks and zero critical responsibilities removed without replacement evidence.
