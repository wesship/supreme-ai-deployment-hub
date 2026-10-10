# D3VONN.IO CI/CD Workflow Inventory

Status: Metadata-only stabilization baseline  
Date: 2026-07-31  
Owner: Wesley Little  
Tracking: #624

## Purpose

Map the current GitHub Actions surface before deleting, merging, renaming, or changing any required check or branch-protection rule.

This document records metadata and consolidation candidates only. It does not authorize workflow deletion.

## Existing evidence

The repository already includes workflow-audit tooling and generated reports under:

- `scripts/workflow-audit/`
- `scripts/workflow-audit/reports/inventory.tsv`
- `scripts/workflow-audit/reports/risk-score.tsv`
- `scripts/workflow-audit/reports/permissions-audit.tsv`
- `governance/workflow-fingerprints.txt`

The generated inventory identifies a very large workflow surface spanning CI, security, deployment, promotion, observability, cost governance, dependency automation, disaster recovery, AI governance, and production certification.

The generated report is not fully current. Newer workflows visible on `main`, including D3VONN production certification and operations workflows, are not consistently represented in the checked-in report. Regenerating the inventory is required before any consolidation PR.

## Required-check protection rule

Before changing or deleting a workflow:

1. Identify every check name it emits.
2. Determine whether the check is required by branch protection, rulesets, promotion logic, or another workflow.
3. Identify its unique security, deployment, evidence, or rollback responsibility.
4. Provide a replacement or prove the responsibility is duplicated.
5. Validate the change on a branch with no reduction in required protection.
6. Use a reversible PR with explicit rollback instructions.

## Primary overlap clusters

### 1. Deployment and publication

Candidate workflows:

- `deploy.yml`
- `deploy-and-publish.yml`
- `devonn-deploy.yml`
- `release.yml`
- `vps-deploy.yml`
- `azure-container-apps-deploy.yml`
- `eks-deploy-oidc.yml`
- `oidc-deploy.yml`
- `infrastructure-ci-cd.yml`

Risk: high. These may target different providers, environments, or historical architectures. Do not consolidate until active production targets and secret scopes are mapped.

### 2. Promotion and environment movement

Candidate workflows:

- `promotion.yml`
- `deployment-promotion.yml`
- `multi-env-promotion.yml`
- `platform-graduation.yml`
- `platform-control-plane.yml`

Risk: critical. These may encode approvals, environment protection, rollback, image provenance, or release gates. First map which workflow is canonical for Vercel, Railway, Supabase, VPS, and container promotion.

### 3. Test and quality gates

Candidate workflows:

- `build.yml`
- `testing.yml`
- `e2e.yml`
- `e2e-smoke-tests.yml`
- `code-quality-gates.yml`
- `coverage.yml`
- `coverage-enforcement.yml`
- `final-green-check.yml`
- `required-pr-gate.yml`

Risk: high. Similar commands may be intentional layers. Required check names and exact job dependencies must be mapped before consolidation.

### 4. Security and supply chain

Candidate workflows:

- `security-hardening.yml`
- `codeql.yml`
- `dependency-review.yml`
- `grype.yml`
- `container-hardening.yml`
- `trusted-build.yml`
- `trusted-runner-isolation.yml`
- `cosign-sign-verify.yml`
- `sbom.yml`
- `sbom-generation.yml`
- `secrets-elimination.yml`
- `validate-secrets.yml`
- `secret-governance.yml`

Risk: critical. Different scanners and attestations are complementary unless their exact scope is proven redundant.

### 5. Dependency automation

Candidate workflows:

- `auto-dependency-upgrade.yml`
- `dependency-auto-fix.yml`
- `dependabot-auto-merge-guard.yml`
- `auto-merge-snyk.yml`
- `auto-merge.yml`

Risk: high. Multiple mutation-capable automations may race or bypass intended review policy. Consolidation should start by disabling overlap in write behavior, not by removing scanning.

### 6. Production health and observability

Candidate workflows:

- `platform-health-dashboard.yml`
- `e2e-smoke-tests.yml`
- `metrics-export.yml`
- `incident-response.yml`
- `self-healing-v2.yml`
- `autonomous-remediation.yml`
- `observability.yml`
- `ci-baseline-metrics.yml`
- `ci-analytics.yml`

Risk: high. Several workflows run every 5, 15, or 30 minutes. Review runner cost, duplicate probes, false-positive behavior, and mutation authority.

### 7. D3VONN production certification

Current workflows include:

- `d3vonn-authenticated-audit.yml`
- `d3vonn-backend-api-audit.yml`
- `d3vonn-post-deploy-audit-mobile.yml`
- `d3vonn-production-performance.yml`
- `d3vonn-contact-delivery-certification.yml`
- `contact-production-canary.yml`
- `ai-platform-readonly-certification.yml`
- `d3vonn-ai-functional-certification.yml`
- `d3vonn-operations-verification.yml`

Risk: medium to critical depending on secrets and write canaries. Preserve the launch evidence chain. Consolidate only where workflows have identical triggers, identities, cleanup, and evidence requirements.

## Immediate findings

1. The workflow surface is large enough that deletion by filename similarity would be unsafe.
2. The checked-in generated inventory is stale relative to current `main`.
3. Promotion and deployment responsibilities are fragmented across multiple generations and providers.
4. Multiple scheduled workflows run at high frequency and may duplicate health checks, metrics collection, incident detection, or remediation.
5. Dependency automation includes several write-capable paths that require race-condition and permission review.
6. Security workflows appear overlapping by name but may provide distinct SAST, dependency, container, provenance, secret, and runner-isolation controls.
7. D3VONN certification workflows should be treated as a protected evidence layer until their outputs are mapped to the completed launch record.

## Next implementation sequence

### Phase A — refresh metadata

- Regenerate inventory, risk score, permissions audit, dead-path report, and fingerprints from current `main`.
- Add workflow name, job names, concurrency group, environment, artifact retention, permissions, reusable-workflow dependencies, secret references by name only, and emitted check names.
- Compare regenerated reports to checked-in reports and fail CI when reports are stale.

### Phase B — required-check map

- Export repository ruleset and branch-protection required check names.
- Map each required check to workflow file and job.
- Identify orphaned required checks and unprotected critical workflows.

### Phase C — non-destructive normalization

- Standardize naming, concurrency, retention, and evidence metadata without deleting workflows.
- Reduce duplicate schedules where two workflows perform the same read-only probe.

### Phase D — reversible consolidation

Process one cluster per PR in this order:

1. stale reports and metadata generation;
2. read-only monitoring duplicates;
3. dependency mutation automation;
4. test/coverage duplication;
5. deployment and promotion workflows last.

## Exit criteria

- Current inventory covers every workflow on `main`.
- Every required check maps to one owning workflow and job.
- Every workflow has an owner, purpose, risk, trigger, concurrency policy, permissions summary, artifact policy, and disposition.
- No workflow is deleted without exact replacement evidence.
- Runner cost and schedule frequency are measurable.
- Production promotion, security, and rollback protections are not weakened.
