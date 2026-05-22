# Required Status Checks — main branch

These checks MUST pass before any PR may merge to `main`. Configured in
GitHub → Settings → Branches → `main` → Branch protection rules.

## Mandatory (block merge on failure)

- `build` — production build succeeds
- `lint` — eslint + typescript no errors
- `test` — vitest suite green
- `security/snyk` — no new high/critical vulns
- `governance/dependabot-auto-merge-guard` — no risky majors auto-merging
- `supabase/migration-dry-run` — pending migrations parse cleanly

## Advisory (warn, do not block)

- `bundle-size` — alerts >5% growth
- `a11y` — accessibility regressions
- `ci-analytics` — flaky-test surface

## Branch protection settings

- Require PR before merging: **YES**
- Require approvals: **1** (2 for governance/ paths)
- Dismiss stale reviews on push: **YES**
- Require conversation resolution: **YES**
- Require signed commits: **PREFERRED** (enforce after migration to signed commits)
- Require linear history: **YES**
- Require deployments to succeed: production env
- Lock branch: **NO** (use merge queue instead)
- Do not allow force pushes: **YES**
- Do not allow deletions: **YES**
- Allow merge queue: **YES** (squash merge)

## Change control

Modifying this list requires a PR to `governance/REQUIRED_CHECKS.md`
with sign-off from @core-platform and @security.
