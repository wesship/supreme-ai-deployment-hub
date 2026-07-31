# CI/CD Phase A — Current-Main Metadata Refresh

Status: Approved stabilization work
Owner: Wesley Little
Tracking: #624

## Baseline

The self-documenting platform reports 139 GitHub Actions workflows on current `main`. Existing checked-in audit reports do not fully cover the newer D3VONN certification and operations workflows.

## Scope

Refresh metadata only. Do not delete, rename, disable, consolidate, or change workflow triggers, permissions, environments, schedules, required checks, branch protection, deployment targets, or secrets.

## Required outputs

For every `.github/workflows/*.yml` and `.yaml` file, generate one canonical record containing:

- file path
- workflow display name
- job IDs and emitted job names
- triggers and branch/path filters
- schedule expressions
- concurrency group and cancellation behavior
- top-level and job-level permissions
- referenced GitHub environments
- referenced secret names only
- reusable workflow calls
- artifact names and retention days
- deployment or mutation capability
- owner, risk, and lifecycle disposition

Generate refreshed versions of:

- `scripts/workflow-audit/reports/inventory.tsv`
- `scripts/workflow-audit/reports/risk-score.tsv`
- `scripts/workflow-audit/reports/permissions-audit.tsv`
- dead-path report
- workflow fingerprints
- duplicate/overlap candidate report

## Safety requirements

- Never print or persist secret values.
- Treat `${{ secrets.NAME }}` only as metadata name `NAME`.
- Do not infer required checks from filenames.
- Do not classify two workflows as duplicates unless trigger, jobs, commands, permissions, environment, mutation authority, and evidence outputs materially overlap.
- Fail closed if workflow YAML cannot be parsed.
- Preserve deterministic ordering so report drift is reviewable.

## Validation

- Count of inventory records equals the count of workflow YAML files on the analyzed commit.
- Every workflow has at least one purpose/risk classification.
- Every job ID is represented.
- Every schedule is captured exactly.
- Every write-capable permission and production environment reference is flagged.
- Running the generator twice on the same commit produces no diff.

## Deliverable sequence

1. Improve the report generator on a dedicated branch.
2. Regenerate reports against current `main`.
3. Add tests using representative workflow fixtures.
4. Open a draft PR linked to #624.
5. Merge only after required PR gates pass.

## Out of scope

- Workflow deletion or consolidation
- Branch-protection or ruleset changes
- Required-check renaming
- Schedule reduction
- Deployment changes
- Secret rotation or environment mutation
