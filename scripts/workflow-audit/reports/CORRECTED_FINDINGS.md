# Phase 6 — Workflow Audit: Corrected Findings

_Updated: 2026-05-22 — supersedes initial duplicate-detector output_

## Headline Reversal

The first-pass duplicate detector reported "50 of 107 workflows are duplicates."
**This was a false positive.** The detector clustered workflows by shared
`uses:` action references — every scheduled Python audit pulls in
`actions/checkout` + `actions/setup-python` + `actions/upload-artifact`, so they
all collided to the same hash even though their job logic is unique.

After fixing the detector to normalize and hash the full workflow body
(stripping `name:`, comments, whitespace), the real numbers are:

| Metric | Initial claim | Corrected |
|---|---|---|
| True byte-identical duplicates | 50 | **0** |
| Near-duplicates (≥70% line overlap) | — | **0** |
| Distinct workflows | ~57 | **107** |

**Implication:** consolidation gains are much smaller than projected.
The 107 workflows are mostly distinct, not redundant.

## What is actually safe to archive (post-lock)

Without duplicates as a source, archival candidates must come from:

1. **Stale** — no successful run in >90 days (run `scripts/workflow-audit/stale-workflows.sh` on your machine; needs `gh auth`)
2. **Broken dependencies** — references deleted branches, removed infra, or missing required secrets
3. **Explicit experimental markers** — workflows tagged `experimental`, `wip`, `draft`, or in `archive/`
4. **High-risk + unused** — score ≥4 from `risk-score.tsv` AND no successful runs

## Real findings worth acting on

### High-risk workflows requiring review BEFORE lock

| Workflow | Score | Concern |
|---|---|---|
| `deployment-promotion.yml` | 5 | `workflow_run` chain + broad write perms — confirm trigger safety |
| `terraform.yml` | 4 | 14 secrets used + broad perms — verify least privilege |
| `oidc-deploy.yml` | 4 | 8 secrets + broad perms |
| `infrastructure-ci-cd.yml` | 4 | 6 secrets + broad perms |
| `dependabot-auto-merge-guard.yml` | 4 | `pull_request_target` — intentional but document why |
| `cost-attribution.yml` | 4 | 4 secrets + broad perms |
| `azure-container-apps-deploy.yml` | 4 | 7 secrets + broad perms |

### Lower-priority cleanup signals

24 workflows use `contents: write` or similar broad permissions where they
likely only need `contents: read`. Scoping these down is a separate
hardening pass (Phase 8), not a Phase 6 consolidation move.

## Revised Phase 6 plan

1. **Audit ownership** — fill in `governance/WORKFLOW_OWNERS.md` for all 107
2. **Run stale check** — once you run `stale-workflows.sh`, archive the truly cold ones
3. **Permission scope-down** — drop the 7 high-risk workflows above to least privilege (separate PR per workflow for clean revert)
4. **Skip the "consolidate to 60" target** — it was based on a false-positive count. The right target is now "every workflow has an owner and a green run in the last 90 days."

## Tooling status

- `inventory.sh` — accurate (107 rows)
- `detect-duplicates.sh` — **corrected**, now uses normalized body hash
- `workflow-risk-score.sh` — accurate
- `stale-workflows.sh` — needs `gh auth` from your machine
- `archive-candidates.sh` — accurate, now reflects 0 duplicates
- `fingerprint-workflows.sh` — 106 hashes captured, ready for drift baseline
