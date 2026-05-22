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
