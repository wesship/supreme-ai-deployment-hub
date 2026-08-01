# D3VONN.IO Observed Check Ownership Map

Status: Metadata-only stabilization evidence  
Date: 2026-08-01  
Owner: Wesley Little  
Tracking: #624

## Scope

This document maps check and workflow names observed on the exact PR #664 head (`16b1696e7799919fceff3e0c2b5c7b226b9c7c19`) to their repository workflow owners. It is evidence for CI/CD stabilization only.

It does **not** claim that every observed check is required by branch protection. The connected GitHub surface does not expose the live repository-ruleset or branch-protection required-status-context export. Protection source therefore remains `pending live export` unless explicitly identified below.

No workflow, job, ruleset, branch-protection setting, trigger, environment, secret, or deployment configuration is changed by this map.

## Canonical aggregate gate

| Observed check/workflow | Owning workflow file | Owning job/check | Trigger | Protection source | Disposition |
|---|---|---|---|---|---|
| D3VONN Required PR Gate | `.github/workflows/required-pr-gate.yml` | `required-pr-gate` / `D3VONN Required PR Gate` | pull request to `main` | pending live export; repository-designated canonical candidate | Preserve. Do not rename or remove before ruleset export. |

The canonical aggregate gate installs from the frozen lockfile, runs TypeScript, lint, frontend tests, production build, backend syntax/imports, focused backend tests, secret scanning, YAML validation, and action-reference validation.

## GitHub Actions checks observed on PR #664

| Observed workflow/check | Workflow owner | Primary responsibility | Protection source | Stabilization note |
|---|---|---|---|---|
| API Contract Testing | `.github/workflows/api-contract-testing.yml` | API/OpenAPI contract validation | pending live export | Keep until contract coverage is compared with aggregate and E2E gates. |
| Coverage Enforcement | `.github/workflows/coverage-enforcement.yml` | Frontend/backend coverage policy | pending live export | Potential overlap with `coverage.yml` and build/testing workflows. |
| Verify Vercel Build | `.github/workflows/verify-vercel-build.yml` | Referenced build-script and Vercel production-build validation | pending live export | Uses mutable action tags; pinning is separate debt. |
| Promotion Validation | `.github/workflows/promotion.yml` | Promotion validation and evidence | pending live export | High-risk deployment responsibility; no consolidation yet. |
| Test Coverage | `.github/workflows/coverage.yml` | Coverage generation | pending live export | Duplicate/overlap candidate; preserve pending evidence comparison. |
| CI - Hardened Build Pipeline | `.github/workflows/build.yml` | Frontend/backend build and security scan | pending live export | Overlaps required gate and testing workflow. |
| PR Automation | `.github/workflows/pr-automation.yml` | PR metadata, labels, review summary, stale handling | pending live export | Write-capable governance automation. |
| Container Hardening | `.github/workflows/container-hardening.yml` | Container vulnerability and policy checks | pending live export | Complementary security control until scope comparison proves otherwise. |
| Validate VPS deployment | `.github/workflows/validate-vps-deployment.yml` | VPS deployment validation | pending live export | Provider-specific; do not merge with Vercel/Railway validation. |
| Bundle Size Check | `.github/workflows/bundle-size.yml` | Bundle regression analysis | pending live export | Preserve as performance guard. |
| Cosign Sign & Verify (Sigstore) | `.github/workflows/cosign-sign-verify.yml` | Artifact/image signing and verification | pending live export | Supply-chain control; preserve. |
| Final Green Check | `.github/workflows/final-green-check.yml` | Aggregate release-readiness status | pending live export | Overlap candidate after exact dependency ownership is documented. |
| Trusted Runner Isolation | `.github/workflows/trusted-runner-isolation.yml` | Runner trust and isolation policy | pending live export | Security control; preserve. |
| D3VONN.IO Testing | `.github/workflows/testing.yml` | Broad frontend/backend/proxy/browser test suites | pending live export | Contains unique suites despite overlap with build/coverage gates. |
| Commit Lint | `.github/workflows/commitlint.yml` | Conventional commit validation | pending live export | Keep; historical naming failure does not justify removal. |
| Code Quality Gates | `.github/workflows/code-quality-gates.yml` | Frontend/backend quality checks | pending live export | Overlap candidate; compare unique commands first. |
| CodeQL SAST | `.github/workflows/codeql.yml` | Canonical CodeQL analysis | pending live export | Authoritative CodeQL owner; preserve. |
| Lighthouse CI | `.github/workflows/lighthouse.yml` | Lighthouse performance/accessibility baseline | pending live export | Preserve production-quality evidence. |
| Secret Scanning (Gitleaks) | `.github/workflows/gitleaks.yml` | Repository secret scanning | pending live export | Preserve; distinct from application bundle scanner. |
| Security Hardening | `.github/workflows/security-hardening.yml` | Security policy and hardening validation | pending live export | Compare scope, not filename, before consolidation. |
| Devonn.AI Deploy | `.github/workflows/devonn-deploy.yml` | Legacy-branded deployment path | pending live export | High-priority ownership review; do not delete until active target is disproved. |
| Accessibility CI | `.github/workflows/accessibility.yml` | WCAG/axe/pa11y validation | pending live export | Preserve accessibility protection. |
| Governance Drift Check | `.github/workflows/governance-drift-check.yml` | Governance metadata and policy drift | pending live export | Preserve until governance ownership is mapped. |

## External status contexts observed on the same PR head

| Observed context | Owner | Protection source | Disposition |
|---|---|---|---|
| Vercel – `supreme-ai-deployment-hub` | Vercel Git integration | pending live export | Preserve production frontend preview/deployment validation. |
| Vercel – `repo-clone` | Vercel Git integration | pending live export | Duplicate-project cleanup candidate; verify project ownership before removal. |
| security/snyk (`wesship`) | Snyk Git integration | pending live export | Preserve until organization/integration ownership is reconciled. |
| security/snyk (`wesship8`) | Snyk Git integration | pending live export | Duplicate-organization cleanup candidate; verify active policy ownership first. |

## Verified overlap clusters

1. **Base build/test duplication:** `required-pr-gate.yml`, `build.yml`, `testing.yml`, `code-quality-gates.yml`, `coverage.yml`, `coverage-enforcement.yml`, and `final-green-check.yml` repeat portions of install, lint, type-check, test, coverage, and build work.
2. **External integration duplication:** two Vercel project contexts and two Snyk organization contexts report on the same PR head.
3. **Deployment generations:** `devonn-deploy.yml`, `promotion.yml`, Vercel checks, Railway checks, VPS validation, and other deployment workflows must be separated by actual target and authority before consolidation.
4. **Security controls:** CodeQL, Gitleaks, Snyk, container hardening, trusted-runner isolation, Cosign, and security-hardening checks are not interchangeable without scope evidence.

## Required live export still needed

Populate the final protection map from:

- repository rulesets targeting `main`;
- classic branch protection for `main`, if present;
- exact required status-check contexts and integration IDs;
- bypass actors and administrator-enforcement policy;
- merge queue requirements, if enabled.

Final map columns:

| Required context | Workflow/integration owner | Job/check | Protection source | Enforcement/bypass | Replacement/disposition |
|---|---|---|---|---|---|

## Safe next PR sequence

1. Export live ruleset and branch-protection metadata; make no mutation.
2. Replace `CI_CD_REQUIRED_CHECK_MAP_PENDING.md` with the verified final map.
3. Reconcile duplicate Vercel and Snyk external contexts by ownership, not by name.
4. Compare base build/test command coverage and identify one small reversible duplication-removal PR.
5. Leave deployment, promotion, security, signing, and production-certification consolidation until last.

## Acceptance boundary

No workflow or external check may be renamed, removed, or made nonblocking based only on this observed map. A consolidation PR requires the live protection export plus exact replacement evidence.
