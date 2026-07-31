# CI/CD Required-Check Map — Pending Live Ruleset Export

Status: Blocked only on repository ruleset/branch-protection metadata export.

The workflow inventory and overlap analysis are complete in `CI_CD_WORKFLOW_INVENTORY_2026-07-31.md`.

A correct required-check map cannot be inferred from workflow filenames alone. The next pass must export the active GitHub repository rulesets and branch-protection required status checks, then map each exact check context to its workflow file and job ID.

Until that export is available:

- do not delete or rename workflow jobs;
- do not alter required checks;
- do not consolidate deployment, promotion, security, or production-certification workflows;
- treat missing ownership mappings as technical debt, not permission to remove a check.

Required map columns:

| Required check context | Workflow | Job ID | Trigger | Environment | Protection source | Replacement/disposition |
|---|---|---|---|---|---|---|

Completion requires zero orphaned required checks and zero critical workflows lacking protection.
