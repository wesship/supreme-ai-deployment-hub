# Devonn.AI Deployment Hub — Platform Architecture

> **Version:** `platform-v24.0`  
> **Last Updated:** May 2026  
> **Workflows:** 99 GitHub Actions  
> **Security Posture:** Zero CVEs · 228 SHA-pinned actions · SLSA Level 3  
> **Compliance:** SOC 2 Type II evidence · DORA Elite/High performer

---

## Overview

The Devonn.AI Deployment Hub is a **zero-trust, GitOps-driven, AI-governed orchestration platform** built on GitHub Actions. It provides a complete software delivery lifecycle — from developer commit to production deployment — with automated security enforcement, observability, cost governance, and compliance reporting.

The platform was hardened across **24 sequential waves** of engineering, each layer depending on guarantees established by the previous one.

---

## Architecture Layers

The 99 workflows are organized into 10 architectural layers:

### Layer 1 — Foundation & Build (8 workflows)
Core CI/CD pipeline, lockfile integrity, and build hardening.

| Workflow | Purpose |
|---|---|
| `build.yml` | Hardened build pipeline with concurrency and caching |
| `testing.yml` | Full test suite (unit, integration) |
| `coverage.yml` | Test coverage reporting |
| `coverage-enforcement.yml` | Hard gate: ≥70% line, ≥60% branch coverage |
| `mutation-tests.yml` | Stryker mutation testing |
| `lockfile-integrity.yml` | Drift detection on `package-lock.json` |
| `reusable-node-setup.yml` | Reusable Node 22 setup with caching |
| `commitlint.yml` | Conventional commit enforcement |

### Layer 2 — Security & Supply Chain (14 workflows)
Zero-trust artifact trust chain from source to deployment.

| Workflow | Purpose |
|---|---|
| `codeql.yml` | SAST: CodeQL static analysis |
| `dependency-review.yml` | Block PRs with high/critical CVEs |
| `security-hardening.yml` | Dependency audit, action SHA audit, branch protection |
| `secrets-elimination.yml` | Gitleaks full-history scan + OIDC migration audit |
| `validate-actions.yml` | Detect fake/mutable SHA pins on every PR |
| `validate-secrets.yml` | Verify required secrets are configured |
| `artifact-provenance.yml` | SLSA Level 3 provenance attestations (Sigstore) |
| `cosign-sign-verify.yml` | Keyless Cosign signing + Rekor transparency log |
| `sbom-generation.yml` | Syft SBOM (CycloneDX + SPDX) + Grype scan |
| `sbom.yml` | Supply chain security baseline |
| `container-hardening.yml` | Hadolint + Trivy + Grype on distroless image |
| `trusted-build.yml` | Hermetic build with environment fingerprinting |
| `trusted-runner-isolation.yml` | StepSecurity harden-runner + OIDC workload attestation |
| `auto-merge-snyk.yml` | Auto-merge Snyk security PRs |

### Layer 3 — Policy & Compliance (5 workflows)
Machine-enforced governance across the entire SDLC.

| Workflow | Purpose |
|---|---|
| `policy-as-code.yml` | OPA/Conftest: workflow standards, deployment gates, artifact integrity |
| `hermes-gate.yml` | Hermes v2 governance gate (PR merge control) |
| `hermes-v3-gate.yml` | Hermes v3 governance gate (enhanced) |
| `compliance-audit-export.yml` | SOC 2 evidence generation + audit timeline export |
| `kyverno-admission.yml` | Kubernetes admission: signed images, SLSA, SBOM, distroless-only |

### Layer 4 — Deployment & Promotion (8 workflows)
Multi-environment promotion with smoke tests and rollback gates.

| Workflow | Purpose |
|---|---|
| `deploy.yml` | Primary deployment workflow |
| `devonn-deploy.yml` | Devonn-specific deployment |
| `deployment-promotion.yml` | `dev → staging → canary(10%) → production` with approval gates |
| `multi-env-promotion.yml` | Environment-specific config promotion |
| `promotion.yml` | Environment promotion pipeline |
| `oidc-deploy.yml` | OIDC federation for AWS/Azure/GCP/Cloudflare |
| `deploy-and-publish.yml` | Deploy + Chrome Extension publish |
| `azure-container-apps-deploy.yml` | Azure Container Apps CI/CD |

### Layer 5 — Infrastructure & GitOps (6 workflows)
Declarative infrastructure with drift detection and self-healing.

| Workflow | Purpose |
|---|---|
| `terraform.yml` | Terraform deployment pipeline |
| `terraform-aws.yml` | AWS-specific Terraform |
| `iac-drift-detection.yml` | Infrastructure drift detection |
| `infrastructure-ci-cd.yml` | Infrastructure CI/CD pipeline |
| `gitops-reconciliation.yml` | ArgoCD drift detection + auto-sync (every 30 min) |
| `eks-deploy-oidc.yml` | EKS deployment with OIDC + Trivy scan |

### Layer 6 — Observability & Resilience (8 workflows)
Deep telemetry, chaos engineering, and autonomous self-healing.

| Workflow | Purpose |
|---|---|
| `observability.yml` | OpenTelemetry spans + deployment correlation IDs |
| `ebpf-telemetry.yml` | Cilium Tetragon eBPF kernel-level tracing |
| `falco-runtime-detection.yml` | Falco behavioral detection (9 rules, CRITICAL/EMERGENCY) |
| `chaos-engineering.yml` | LitmusChaos: network partition, DB outage, latency injection |
| `autonomous-remediation.yml` | Auto-quarantine, rollout freeze, canary disable, rollback |
| `multi-region-failover.yml` | Multi-region failover + backup integrity verification |
| `disaster-recovery-drill.yml` | Monthly DR drills with RTO/RPO measurement |
| `incident-response.yml` | Automated incident lifecycle + SLO breach alerting |

### Layer 7 — AI Platform Governance (6 workflows)
AI-specific safety, cost control, and model lifecycle management.

| Workflow | Purpose |
|---|---|
| `ai-model-pipeline.yml` | AI model pipeline orchestration |
| `ai-model-governance.yml` | Model registry, approval gates, rollback triggers |
| `ai-safety-guardrails.yml` | Content policy, hallucination detection, output validation |
| `llm-cost-governance.yml` | Token budget enforcement + provider cost comparison |
| `ab-testing.yml` | A/B testing with Welch's t-test significance |
| `threat-intelligence.yml` | MITRE ATT&CK mapping + CVE feed analysis |

### Layer 8 — Quality & Developer Experience (10 workflows)
Code quality gates, PR automation, and developer productivity.

| Workflow | Purpose |
|---|---|
| `code-quality-gates.yml` | ESLint, TypeScript strict, cyclomatic complexity, Bandit |
| `e2e.yml` | End-to-end tests |
| `e2e-smoke-tests.yml` | Live E2E smoke tests every 15 min with auto-incident creation |
| `api-contract-testing.yml` | OpenAPI contract validation + dredd live tests |
| `performance-regression.yml` | Bundle size (<850KB) + API latency budget enforcement |
| `load-test.yml` | Load testing |
| `lighthouse.yml` | Lighthouse CI (performance, accessibility, SEO) |
| `accessibility.yml` | Accessibility CI |
| `bundle-size.yml` | Bundle size tracking |
| `pr-automation.yml` | Auto-labelling, size checks, stale management, first-contributor greeting |

### Layer 9 — Platform Intelligence (8 workflows)
Self-optimizing, self-documenting, and predictive capabilities.

| Workflow | Purpose |
|---|---|
| `ci-analytics.yml` | AI-driven failure pattern detection + flaky test identification |
| `predictive-failure-detection.yml` | ML risk scoring on every PR before merge |
| `workflow-optimizer.yml` | Concurrency, timeout, and parallelisation recommendations |
| `self-documenting-platform.yml` | Auto-generate ARCHITECTURE.md + capability catalog |
| `ml-anomaly-detection.yml` | Z-score statistical SLO drift detection |
| `dora-metrics.yml` | DORA Four Key Metrics (deployment frequency, lead time, MTTR, CFR) |
| `platform-graduation.yml` | 25-criteria platform maturity scorecard |
| `platform-health-dashboard.yml` | 0-100 health score + static status page (every 15 min) |

### Layer 10 — Business Intelligence & Ecosystem (16 workflows)
Cost attribution, SLA reporting, ecosystem integration, and developer tooling.

| Workflow | Purpose |
|---|---|
| `cost-attribution.yml` | Cloud spend + LLM ROI + CI compute cost tracking |
| `cost-optimization.yml` | Cost optimization recommendations |
| `usage-analytics.yml` | API telemetry, feature adoption, user journey, cohort retention |
| `sla-reporting.yml` | Monthly SLA certificates + compliance reports |
| `billing-reconciliation.yml` | Budget vs actual + anomaly detection |
| `notifications.yml` | Slack + Microsoft Teams alerting |
| `metrics-export.yml` | Datadog / Grafana / Prometheus push gateway |
| `issue-tracker-sync.yml` | Jira + Linear ticket creation from incidents |
| `platform-control-plane.yml` | Unified status/rollback/health/freeze control plane |
| `release-notes.yml` | Automated changelog + GitHub Release generation |
| `release.yml` | Release workflow |
| `auto-dependency-upgrade.yml` | Weekly automated dependency upgrade PRs |
| `dependency-auto-fix.yml` | npm audit fix automation |
| `developer-onboarding.yml` | Golden path templates + capability catalog |
| `auto-fix.yml` | Autonomous fix engine |
| `issue-trigger.yml` | Issue → AI fix trigger |

---

## Security Architecture

```
Developer Commit
      │
      ▼
┌─────────────────────────────────────────────┐
│  PR Gate (Hermes v3)                        │
│  • SHA pin validation                       │
│  • Predictive risk scoring                  │
│  • Dependency review (block critical CVEs)  │
│  • Code quality gates                       │
│  • Coverage enforcement                     │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│  Build (Trusted + Hermetic)                 │
│  • Lockfile integrity verification          │
│  • Environment fingerprinting               │
│  • StepSecurity harden-runner               │
│  • OIDC workload attestation                │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│  Artifact Trust Chain                       │
│  • SLSA Level 3 provenance (Sigstore)       │
│  • Cosign keyless signing (Rekor log)       │
│  • CycloneDX + SPDX SBOM                   │
│  • Grype + Trivy vulnerability scan         │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│  Deployment Promotion Gates                 │
│  dev → staging → canary(10%) → production  │
│  • Smoke tests at each gate                 │
│  • Manual approval for production           │
│  • Cosign signature verification            │
│  • OPA policy evaluation                   │
└─────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────┐
│  Runtime Protection                         │
│  • Kyverno admission (signed images only)   │
│  • Falco behavioral detection               │
│  • Cilium Tetragon eBPF tracing             │
│  • Autonomous remediation                   │
└─────────────────────────────────────────────┘
```

---

## Key Metrics at a Glance

| Metric | Value |
|---|---|
| Total Workflows | 99 |
| SHA-Pinned Actions | 228 |
| CVEs (npm audit) | 0 |
| YAML Syntax Errors | 0 |
| OPA Policies | 4 |
| Falco Rules | 9 |
| Kyverno ClusterPolicies | 5 |
| Deployment Environments | 4 (dev, staging, canary, production) |
| SLSA Level | 3 |
| SOC 2 Controls Mapped | 25 |
| Compliance Standards | SOC 2 Type II, SLSA, CycloneDX, SPDX |

---

## Activation Checklist

The following secrets must be configured in GitHub repository settings to activate all capabilities:

| Secret | Required By | Description |
|---|---|---|
| `SUPABASE_URL` | deploy, edge-functions | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | deploy, edge-functions | Supabase service role key |
| `OPENAI_API_KEY` | ai-model-pipeline, llm-cost | OpenAI API key |
| `ELEVENLABS_API_KEY` | devonn-deploy | ElevenLabs voice API key |
| `AWS_ROLE_ARN` | oidc-deploy, eks-deploy | AWS OIDC role ARN |
| `AZURE_CLIENT_ID` | oidc-deploy, azure-deploy | Azure federated credential client ID |
| `GCP_WORKLOAD_IDENTITY` | oidc-deploy | GCP Workload Identity provider |
| `VAULT_ADDR` | vault-secrets-injection | HashiCorp Vault address |
| `SLACK_WEBHOOK_URL` | notifications | Slack incoming webhook |
| `DATADOG_API_KEY` | metrics-export | Datadog API key |
| `JIRA_BASE_URL` | issue-tracker-sync | Jira instance URL |
| `JIRA_API_TOKEN` | issue-tracker-sync | Jira API token |

---

*This document is automatically regenerated by `self-documenting-platform.yml` on every push to `main`.*
