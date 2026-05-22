# Workflow Archive Candidates
_Generated: 2026-05-22T14:04:56Z_

**Review every entry before archiving. Do NOT delete pre-lock — only move to `.github/workflows/archive/` after `v1.0-prod-lock` is tagged.**

## 1. Stale (>90 days since last run / never ran)
_run stale-workflows.sh first_

## 2. Duplicate signatures
── Duplicate / near-duplicate workflow signatures ──

Signature d5d4f22da1b4748f6bc3039c4c817a1ac9631b1264ad01c8a5d87867c4868161 matched 17 workflows:
  - ai-agent-observability.yml
  - billing-reconciliation.yml
  - ci-analytics.yml
  - cost-attribution.yml
  - disaster-recovery-drill.yml
  - dora-metrics.yml
  - metrics-export.yml
  - multi-cloud-cost-arbitrage.yml
  - multi-region-failover.yml
  - observability.yml
  - platform-control-plane.yml
  - platform-graduation.yml
  - sla-reporting.yml
  - threat-intelligence.yml
  - usage-analytics.yml
  - workflow-optimizer.yml
  - zero-downtime-migration.yml

Signature a82b6c268f490b502fdee0f26aa21172b0e8a5a1b2cf7b83ea39d70cf1a66d37 matched 8 workflows:
  - ab-testing.yml
  - ai-model-governance.yml
  - ai-safety-guardrails.yml
  - feature-flags-db-safety.yml
  - issue-tracker-sync.yml
  - issue-trigger.yml
  - llm-cost-governance.yml
  - self-documenting-platform.yml

Signature 45a0960c51c92855653a31066569b0bf838928bd4665a7a1ca203b8645d0f3c9 matched 7 workflows:
  - autonomous-remediation.yml
  - developer-onboarding.yml
  - ebpf-telemetry.yml
  - falco-runtime-detection.yml
  - load-test.yml
  - platform-health-dashboard.yml
  - vault-secrets-injection.yml

Signature 9d79181968ce771192a2f4462f2dd56c20ff2ebe6710bbe048c57bf249468f32 matched 4 workflows:
  - ci-auth-debugger.yml
  - final-green-check.yml
  - gitops-reconciliation.yml
  - multi-env-promotion.yml

Signature e880ab4afafff1c9a35902542f30f7edd6e7b89534fecfc4acc5b71b49451e47 matched 3 workflows:
  - auto-fix.yml
  - hermes-gate.yml
  - lockfile-integrity.yml

Signature 6c7cc4c0782bde34295fee4c4b45764845b00d4769ea0e170fa10f9db0052cfe matched 3 workflows:
  - incident-response.yml
  - predictive-failure-detection.yml
  - release-notes.yml

Signature 1b16b344db2700df42a5c7f69bc125460ea302639e647aae5ac2aae0f547eca1 matched 3 workflows:
  - ci-baseline-metrics.yml
  - compliance-audit-export.yml
  - hermes-v3-gate.yml

Signature f336ec9b32be664c571d676052e242b857edf250c28748a09442b4ae0d4aef0a matched 2 workflows:
  - mutation-tests.yml
  - performance-regression.yml

Signature e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 matched 2 workflows:
  - notifications.yml
  - validate-secrets.yml

Signature 8b5c51eb1c272a308a5efb48842224f7707d340b9b7626bcf63ee81900205c61 matched 2 workflows:
  - e2e-smoke-tests.yml
  - pr-automation.yml

Signature 5d8d9ac7773479042d1063611acc0ac8f2e004961b6722d7b9028353fbb8317b matched 2 workflows:
  - auto-merge-snyk.yml
  - create-project-board.yml

Signature 13f7156b0e112d5b553d699fb6e5dcedc3fcfc6ecbc45a7ec5ac2ca7fa55def9 matched 2 workflows:
  - cosign-sign-verify.yml
  - trusted-build.yml


## 3. High-risk (score >= 5)
- `deployment-promotion.yml`  ·  score 5  ·   broad-perms; workflow_run;
