# GitHub Ruleset and Required-Check Export Runbook

Status: Read-only operator procedure  
Date: 2026-08-01  
Owner: Wesley Little  
Tracking: #624

## Purpose

Capture the live GitHub ruleset and branch-protection metadata needed to convert the observed check ownership map into an authoritative required-check map.

This procedure is read-only. It must not create, update, delete, enable, disable, or reorder any rule, required check, bypass actor, environment, or merge policy.

## Required access

Use a GitHub owner/admin session or a fine-grained token with read access to repository administration metadata. Do not store the token in the repository or workflow artifacts.

Repository:

```text
wesship/supreme-ai-deployment-hub
```

Target branch:

```text
main
```

## Export through GitHub UI

1. Open repository **Settings**.
2. Open **Rules → Rulesets**.
3. Record each active ruleset targeting `main`:
   - ruleset name and ID;
   - enforcement status;
   - target/ref conditions;
   - required status-check contexts and integration/app ownership;
   - required deployments and environments;
   - required reviews;
   - merge queue settings;
   - bypass actors and bypass mode.
4. Open **Branches → Branch protection rules**.
5. Record any classic rule matching `main`, including required status checks and administrator enforcement.
6. Do not change any setting.

## Export through GitHub CLI

Run from an authenticated trusted workstation. Save output outside the repository until secrets and personal metadata are reviewed.

```bash
set -euo pipefail
repo="wesship/supreme-ai-deployment-hub"
mkdir -p /tmp/d3vonn-ruleset-export

gh api --paginate \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${repo}/rulesets" \
  > /tmp/d3vonn-ruleset-export/repository-rulesets.json

gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${repo}/branches/main/protection" \
  > /tmp/d3vonn-ruleset-export/main-branch-protection.json \
  || printf '%s\n' '{"note":"No classic branch-protection response or rulesets-only configuration"}' \
  > /tmp/d3vonn-ruleset-export/main-branch-protection.json
```

For each repository ruleset ID returned, export full details:

```bash
jq -r '.[].id' /tmp/d3vonn-ruleset-export/repository-rulesets.json |
while read -r ruleset_id; do
  gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/wesship/supreme-ai-deployment-hub/rulesets/${ruleset_id}" \
    > "/tmp/d3vonn-ruleset-export/ruleset-${ruleset_id}.json"
done
```

## Sanitization

Before attaching evidence to GitHub:

- remove token values and authorization headers;
- remove personal email addresses if present;
- retain ruleset IDs, app/integration IDs, check contexts, branch targets, enforcement state, and bypass roles;
- do not modify the factual policy fields.

## Mapping procedure

Compare the sanitized export with:

- `docs/operations/CI_CD_OBSERVED_CHECK_OWNERSHIP_2026-08-01.md`;
- `scripts/workflow-audit/reports/inventory.tsv`;
- `.github/workflows/required-pr-gate.yml`;
- external Vercel and Snyk status contexts observed on recent PRs.

Populate one row per required context:

| Required context | Workflow/integration owner | Job/check | Protection source | Enforcement/bypass | Replacement/disposition |
|---|---|---|---|---|---|

## Completion checks

- Every required status context has exactly one identified workflow or external integration owner.
- No required context is orphaned or permanently stale.
- Critical deployment, security, signing, rollback, and certification workflows that are not required are explicitly classified as intentional non-required evidence or scheduled controls.
- Duplicate Vercel and Snyk contexts have verified ownership before any integration is removed.
- The final map is reviewed before any workflow/job rename or consolidation.

## Rollback

No rollback is required because this procedure is read-only. Delete local `/tmp/d3vonn-ruleset-export` files after the sanitized evidence and final map are recorded.
