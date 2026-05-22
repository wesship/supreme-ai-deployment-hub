# Workflow Audit Log

## 2026-05-22 — `deployment-promotion.yml` hardening (pre-lock fix)

**Issue:** Workflow had `continue-on-error: true` on every smoke test and treated
HTTP 000 (curl connect failure) as success. Result: a real production outage
would be reported as a green deploy.

**Changes:**
1. Removed `continue-on-error: true` from 5 steps:
   - Build for development
   - Dev smoke test
   - Staging smoke test
   - Staging integration tests
   - Canary monitoring
   - Production smoke test
2. Tightened HTTP success regex from `^2` to `^2[0-9]{2}$` — HTTP 000 is now
   correctly treated as failure across all four gates.
3. Replaced `--if-present` and silent skips on `npm run test:integration`
   with an explicit detect-or-warn.
4. Added `set -euo pipefail` to every multi-line shell block.

**Risk re-scored:** 5 → expected ~2 after next audit run (workflow_run + id-token
remain, but both are correctly scoped).

**Reviewer:** Lovable agent — please confirm the `production` GitHub Environment
has a required reviewer configured (manual approval before deploy-production
runs). YAML alone cannot enforce this.

**Fingerprint:** regenerated, baseline updated in `governance/workflow-fingerprints.txt`.


## 2026-05-22 — Phase A: high-risk workflow batch hardening

Applied the `deployment-promotion.yml` discipline to the remaining priority
high-risk workflows. Surveyed 6 files; 3 had real defects, 3 already clean.

### Real defects fixed

**`terraform.yml`**
- L109 `continue-on-error: true` on GCP auth (plan job) — removed. The `if:`
  guard already skips when `GCP_CREDENTIALS_JSON` is absent, so any failure
  here is a real auth failure that must hard-fail.
- L307 `continue-on-error: true` on GCP auth (apply job) — removed. Auth
  failures during apply MUST stop a partial deploy.
- L141–155 `az storage blob lease break ... || true` — replaced with explicit
  exit-code capture. Only the known `LeaseNotPresentWithLeaseOperation` case
  is treated as success; every other non-zero exit now fails the job.
- Added `set -uo pipefail` to the lease-break shell block.

**`eks-deploy-oidc.yml`**
- L29 `continue-on-error: true` on the `scan-source` job — removed. Trivy is
  already pinned to `exit-code: '0'` so vuln findings never fail the job; the
  job-level flag was only swallowing checkout / SARIF-upload failures.

**`cosign-sign-verify.yml`**
- L75 `cat ... | openssl x509 ... || true` — replaced with explicit `if`
  conditional. The pretty-print remains non-fatal (it's diagnostic only) but
  no longer masks a non-zero exit in the same pipeline. Added `set -euo pipefail`.

### Already clean (no behavior change)

- `oidc-deploy.yml` — no offending patterns.
- `gitops-reconciliation.yml` — no offending patterns.
- `autonomous-remediation.yml` — only `if: always()` on incident-report job,
  which is intentional (report MUST be generated when remediation fails).

### Annotated as justified (kept, with rationale in YAML)

| File | Line | Pattern | Rationale |
|---|---|---|---|
| terraform.yml | 390 | `if: always()` | Email notification on both success/failure for audit traceability |
| eks-deploy-oidc.yml | 46 | `if: always()` | SARIF upload required even on scan failure |
| autonomous-remediation.yml | 292 | `if: always()` | Incident report required when upstream remediation jobs fail |
| cosign-sign-verify.yml | 78 | `if openssl ...; else echo warning` | Cert pretty-print is purely diagnostic; signing already validated by self-verify step |

### Verification

- All 6 files pass `yaml.safe_load`.
- Zero remaining bad patterns outside the annotated audit comments.
- Workflow fingerprints regenerated (109 entries, was 106).

### Class of risk eliminated

`silent-continuation` pattern is now absent across all 7 priority
deployment-critical workflows (deployment-promotion + the 6 above). Any
deployment-path step that fails will now fail the job. The only remaining
`if: always()` instances are on notification/reporting jobs where always-run
behavior is the intended semantic.


## 2026-05-22 — Phase B: Agent Runtime Validation Harness

Created `src/__tests__/runtime/` — pins the behavioral contract of
`AutonomousAgentExecutor`, the memory service, and the tool-permission
boundary so silent regressions are caught in CI.

### Results

| Suite | Tests | Status |
|---|---|---|
| `agent-execution` | 5 | passing — status transitions, maxSteps ceiling, stop(), cleanup, init-failure |
| `tool-permission-boundaries` | 3 | passing (1 as regression fence — see finding below) |
| `recovery` | 2 | passing — thrown errors caught, isError observations recorded |
| `memory-persistence` | 4 | passing — URL contract + error propagation pinned |
| `recursive-delegation` | 1 | passing maxSteps proxy + 5 `.todo` for sub-agent runtime |
| `governance-pending` | 0 | 3 `describe.todo` blocks for arbitration / policy / snapshot-restore |

**Total: 14 passing, 1 expected-fail (regression fence), 1 skipped (todos).**

### Runtime Finding — Capability Allow-List Gap

`AutonomousAgentExecutor` treats `mcpTools: []` as "no allow-list configured"
(because `[].length` is falsy at line 73 of `src/lib/mcp/autonomousAgent.ts`)
and falls back to ALL gateway tools. An empty list should mean "no tools
permitted", not "all tools permitted".

Pinned by `it.fails(...)` regression fence in
`tool-permission-boundaries.test.ts`. The test PASSES today (insecure
behavior matches). The moment the executor is fixed to treat `[]` as
deny-all, the test will start failing and demand removal of the `.fails`
marker — closing the gap.

**Suggested fix (separate PR):**
```ts
// before
if (this.run.config.mcpTools?.length) { ... filter ... }
// after
if (this.run.config.mcpTools !== undefined) { ... filter ... }
```

### Class of risk this harness eliminates

Before: the autonomous loop could change shape (skip `mcpTools` filter, drop
`stop()` flag, swallow tool errors, leak `mcpClient` connections) and only
get caught in production. Now: any such drift fails CI.

### Pending runtime work (visible as `.todo` in vitest output)

- Recursive delegation: depth counter, allow-list inheritance, sub-agent step
  budget, circular-delegation detection.
- Arbitration: conflicting-write resolution, priority weights, deterministic
  tie-breaking, audit persistence.
- Governance enforcement: locked-env blocks, policy-violation observation
  steps, human-review tokens, hot-reload.
- Memory continuity: `snapshot()` / `restore()` across executor restart.

These are tracked as failing-to-build features, not silent omissions.

## Phase C — Edge Function Rate Limiting (initial)

- Added shared `supabase/functions/_shared/rateLimit.ts` token-bucket middleware
  (per-key capacity + refill-per-second, 429 with `Retry-After` and
  `X-RateLimit-*` headers).
- Added Deno tests `supabase/functions/_shared/rateLimit.test.ts`
  (capacity, key isolation, refill).
- Migrated `ai-proxy` from ad-hoc fixed-window limiter to shared token bucket
  (10 req/min sustained, burst 10).
- Next: extend to `openai-proxy`, `mcp-gateway`, `secure-credentials`,
  `generate-screenplay`, `generate-film` once integration-tested.

## Phase C — Rollout (proxies + heavy ops)

Wired shared token-bucket limiter into:
- `openai-proxy` — 30 rpm, IP/token keyed (no auth in this proxy)
- `mcp-gateway` — 60 rpm, IP/token keyed
- `secure-credentials` — 20 rpm pre-auth (IP) + 15 rpm post-auth (user)
- `aws-eks-deploy` — 10 rpm post-auth (user-keyed)
- `aws-eks-deploy-v2` — 10 rpm post-auth (user-keyed, uses structured errorResponse)

All 429s emit `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`.

## Phase D — Bulk workflow remediation (auto-applied)

Two mechanical fixes applied across the workflow set; YAML re-validated 0 broken:

1. **Stale `develop` branch refs stripped** — 11 workflows had push/pull_request
   triggers pointing at the non-existent `develop` branch, causing systemic CI
   noise. `scripts/workflow-audit/remediate-develop-branch.sh` strips it from
   inline + block branch lists. Workflows where `develop` is the only branch
   were intentionally left for human review (none in this pass).

2. **`permissions: { contents: read }` injected** — 31 workflows lacked a
   top-level permissions block, inheriting the broad repo default. Script
   `remediate-permissions.sh` injects least-privilege read just above `jobs:`.
   Workflows already declaring custom permissions are untouched.

Fingerprints re-baselined. Audit reports should be re-run after this lands.

## Phase D — Targeted dead-path cleanup

- `infrastructure-ci-cd.yml` path triggers updated `.js` → `.cjs` (real
  script is `.cjs`; trigger filter was stale and the audit flagged it).
- `azure-container-apps-deploy.yml` removed non-existent `azure-deploy`
  branch from push trigger.
- `validate-secrets.yml` removed non-existent `hardening/all-phases` branch
  from push trigger.
- `terraform.yml` `verify-completion.sh` left as-is (call is already
  guarded by `[ -f ... ]`, so it's a benign optional hook).
- Remaining 5 dead-path entries are false positives (doc strings,
  runtime-generated Dockerfiles, env-var names).

### Dead-path re-baseline

After targeted cleanup the scanner reports 6 remaining entries, all
confirmed false positives:
- `bundle-size.yml workdir/base-branch` — env-var name
- `developer-onboarding.yml Dockerfiles, SERVICE/Dockerfile` — README placeholders
- `terraform.yml verify-completion.sh` — guarded by `[ -f ... ]`
- `trusted-runner-isolation.yml Dockerfile.runner` — generated at runtime

Real dead refs: **0**. Total dead-path entries dropped 23 → 6 across Phase D.
