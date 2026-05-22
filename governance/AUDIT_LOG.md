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
