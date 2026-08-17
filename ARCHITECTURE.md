# D3VONN.IO Platform Architecture

> Auto-generated on 2026-08-17 02:27 UTC by the Self-Documenting Platform workflow.

## Overview

This document inventories the repository workflow surface used to build, secure, verify, and operate D3VONN.IO.

**Total Workflows:** 162  
**Catalogued Workflows:** 162  
**Last Updated:** 2026-08-17 02:27 UTC

## Workflow Catalog

| Workflow | File | Triggers | Jobs |
|---|---|---|---:|
| A/B Testing Infrastructure | `ab-testing.yml` |  | 2 |
| Accessibility CI | `accessibility.yml` |  | 2 |
| AI Agent Observability | `ai-agent-observability.yml` |  | 1 |
| AI Films Hermes DAG Certification | `ai-films-hermes-dag-certification.yml` |  | 1 |
| AI Films MovieFlow Retry Certification | `ai-films-movieflow-retry-certification.yml` |  | 1 |
| AI FILMS Production Mastering Canary | `ai-films-production-mastering-canary.yml` |  | 1 |
| AI Films Supabase Rollout | `ai-films-supabase-rollout.yml` |  | 1 |
| AI Model Pipeline | `ai-model-pipeline.yml` |  | 2 |
| AI Model Version Governance | `ai-model-governance.yml` |  | 3 |
| AI Platform Read-Only Certification | `ai-platform-readonly-certification.yml` |  | 1 |
| AI Safety Guardrails (Manual Only) | `ai-safety-guardrails.yml` |  | 1 |
| API Contract Testing | `api-contract-testing.yml` |  | 2 |
| Artifact Provenance & Signing (Manual Only) | `artifact-provenance.yml` |  | 1 |
| Auto Merge Safe PRs | `auto-merge.yml` |  | 1 |
| Automated Dependency Upgrade | `auto-dependency-upgrade.yml` |  | 2 |
| Automated Threat Intelligence | `threat-intelligence.yml` |  | 4 |
| Autonomous Fix Engine | `auto-fix.yml` |  | 1 |
| Autonomous Remediation | `autonomous-remediation.yml` |  | 1 |
| Azure Container Apps CI/CD | `azure-container-apps-deploy.yml` |  | 1 |
| Billing Reconciliation Audit (Manual Only) | `billing-reconciliation.yml` |  | 1 |
| Bundle Size Check | `bundle-size.yml` |  | 1 |
| Chaos Engineering & Resilience Testing | `chaos-engineering.yml` |  | 1 |
| Checkov Terraform Assurance | `checkov-terraform.yml` |  | 1 |
| CI - Hardened Build Pipeline | `build.yml` |  | 4 |
| CI Analytics & Failure Intelligence | `ci-analytics.yml` |  | 1 |
| CI Auth Debugger | `ci-auth-debugger.yml` |  | 1 |
| CI Baseline Metrics | `ci-baseline-metrics.yml` |  | 1 |
| Code Quality Gates | `code-quality-gates.yml` |  | 1 |
| CodeQL SAST | `codeql.yml` |  | 1 |
| Commit Lint | `commitlint.yml` |  | 1 |
| Compliance and Audit Export (Manual Only) | `compliance-audit-export.yml` |  | 1 |
| Contact Production Canary | `contact-production-canary.yml` |  | 1 |
| Container Hardening | `container-hardening.yml` |  | 2 |
| Cosign Sign & Verify (Sigstore) | `cosign-sign-verify.yml` |  | 2 |
| Cost Attribution & LLM ROI Tracking | `cost-attribution.yml` |  | 3 |
| Cost Optimization | `cost-optimization.yml` |  | 2 |
| Coverage Enforcement | `coverage-enforcement.yml` |  | 1 |
| Create Devonn Project Board | `create-project-board.yml` |  | 1 |
| D3VONN Beta QA Agent | `d3vonn-beta-qa-agent.yml` |  | 1 |
| D3VONN Hosted Railway Voice Certification | `voice-railway-hosted-certification.yml` |  | 1 |
| D3VONN Jockey Production Canary | `jockey-production-canary.yml` |  | 1 |
| D3VONN Operations Verification | `d3vonn-operations-verification.yml` |  | 3 |
| D3VONN Railway Voice Production Certification | `voice-railway-production-certification.yml` |  | 1 |
| D3VONN Required PR Gate | `required-pr-gate.yml` |  | 1 |
| D3VONN Voice Production Certification | `voice-production-certification.yml` |  | 1 |
| D3VONN.IO AI Functional Certification | `d3vonn-ai-functional-certification.yml` |  | 1 |
| D3VONN.IO Authenticated Audit | `d3vonn-authenticated-audit.yml` |  | 1 |
| D3VONN.IO Backend API Audit | `d3vonn-backend-api-audit.yml` |  | 1 |
| D3VONN.IO Contact Delivery Certification | `d3vonn-contact-delivery-certification.yml` |  | 1 |
| D3VONN.IO Credential Certification | `d3vonn-credential-certification.yml` |  | 3 |
| D3VONN.IO Launch Readiness | `d3vonn-launch-readiness.yml` |  | 2 |
| D3VONN.IO Post-Deploy Audit | `d3vonn-post-deploy-audit.yml` |  | 1 |
| D3VONN.IO Post-Deploy Mobile Audit | `d3vonn-post-deploy-audit-mobile.yml` |  | 1 |
| D3VONN.IO Production Performance Certification | `d3vonn-production-performance.yml` |  | 1 |
| D3VONN.IO Temporary Railway Cutover | `d3vonn-temporary-railway-cutover.yml` |  | 1 |
| D3VONN.IO Testing | `testing.yml` |  | 7 |
| Dependabot Auto-Merge Guard | `dependabot-auto-merge-guard.yml` |  | 1 |
| Dependency Auto-Fix | `dependency-auto-fix.yml` |  | 1 |
| Dependency Review | `dependency-review.yml` |  | 1 |
| Deploy and Chrome Extension Publish (archived manual lane) | `deploy-and-publish.yml` |  | 1 |
| Deployment Promotion Gates (archived manual lane) | `deployment-promotion.yml` |  | 1 |
| Deprecated api.devonn.ai Route 53 CNAME | `apply-api-cname.yml` |  | 1 |
| Deprecated Route 53 DNS Records | `apply-route53-dns.yml` |  | 1 |
| Developer Experience and Onboarding | `developer-onboarding.yml` |  | 3 |
| Devonn Deploy (archived manual lane) | `devonn-deploy.yml` |  | 1 |
| Devonn.AI Deploy | `deploy.yml` |  | 3 |
| DevonnBench Security Audit | `devonnbench-security.yml` |  | 2 |
| Disaster Recovery Drill | `disaster-recovery-drill.yml` |  | 1 |
| DORA Metrics Tracking (Manual Only) | `dora-metrics.yml` |  | 1 |
| E2E Smoke Tests | `e2e-smoke-tests.yml` |  | 1 |
| eBPF Deep Runtime Telemetry (Cilium Tetragon) | `ebpf-telemetry.yml` |  | 1 |
| Edge Functions Typecheck | `edge-functions-typecheck.yml` |  | 1 |
| EKS Deploy (OIDC + Trivy) | `eks-deploy-oidc.yml` |  | 1 |
| Environment Promotion (archived manual lane) | `promotion.yml` |  | 1 |
| Falco Runtime Behavioral Detection | `falco-runtime-detection.yml` |  | 1 |
| Feature Flags and Database Migration Safety | `feature-flags-db-safety.yml` |  | 3 |
| Final Green Check | `final-green-check.yml` |  | 1 |
| Final Voice Production Activation | `final-voice-activation.yml` |  | 2 |
| Get Route53 NS Records | `get-route53-ns.yml` |  | 1 |
| GitOps State Reconciliation | `gitops-reconciliation.yml` |  | 1 |
| Governance Drift Check | `governance-drift.yml` |  | 1 |
| Governance Review | `hermes-gate.yml` |  | 1 |
| Governance Review v3 | `hermes-v3-gate.yml` |  | 1 |
| Grype Vulnerability Assurance | `grype.yml` |  | 1 |
| Hermes Recency Sync Gate | `hermes-recency-sync.yml` |  | 2 |
| Hermes VPS Readiness | `hermes-vps-readiness.yml` |  | 1 |
| Hostinger VPS Runner Health | `hostinger-vps-health.yml` |  | 1 |
| IaC Drift Detection | `iac-drift-detection.yml` |  | 1 |
| Incident Response & SLO Enforcement | `incident-response.yml` |  | 1 |
| Infrastructure CI/CD Pipeline | `infrastructure-ci-cd.yml` |  | 4 |
| Issue Tracker Sync (Jira / Linear) | `issue-tracker-sync.yml` |  | 2 |
| Issue → AI Fix Trigger | `issue-trigger.yml` |  | 1 |
| Kernel Gateway Owner Deploy Command | `kernel-gateway-owner-command.yml` |  | 1 |
| Kernel Gateway VPS Activation | `kernel-gateway-vps-activation.yml` |  | 1 |
| Kubernetes Admission Enforcement (Kyverno) | `kyverno-admission.yml` |  | 1 |
| Lighthouse CI | `lighthouse.yml` |  | 1 |
| LLM Cost Governance | `llm-cost-governance.yml` |  | 2 |
| Load Tests | `load-test.yml` |  | 1 |
| Lockfile Integrity | `lockfile-integrity.yml` |  | 1 |
| Manual VPS Release Deploy | `manual-vps-release-deploy.yml` |  | 1 |
| ML-Based Anomaly Detection (Manual Only) | `ml-anomaly-detection.yml` |  | 1 |
| Multi-Cloud Cost Arbitrage | `multi-cloud-cost-arbitrage.yml` |  | 1 |
| Multi-Environment Promotion Automation (archived manual lane) | `multi-env-promotion.yml` |  | 1 |
| Multi-Region Failover & Backup Verification | `multi-region-failover.yml` |  | 1 |
| Mutation Tests | `mutation-tests.yml` |  | 2 |
| Observability & Telemetry | `observability.yml` |  | 3 |
| OIDC Deployment Federation | `oidc-deploy.yml` |  | 4 |
| Operational Stress Intelligence | `stress-validation.yml` |  | 2 |
| Performance Regression Detection (Manual Only) | `performance-regression.yml` |  | 1 |
| Platform Control Plane | `platform-control-plane.yml` |  | 1 |
| Platform Graduation Criteria & Developer Metrics | `platform-graduation.yml` |  | 3 |
| Platform Health Dashboard | `platform-health-dashboard.yml` |  | 1 |
| Platform Metrics Export (Datadog / Grafana / Prometheus) | `metrics-export.yml` |  | 1 |
| Platform Notifications (Manual Only) | `notifications.yml` |  | 1 |
| Platform Self-Healing v2 | `self-healing-v2.yml` |  | 1 |
| Playwright E2E Audit | `e2e.yml` |  | 1 |
| Policy Review | `policy-as-code.yml` |  | 1 |
| Pollo Entitlement + E2E Retry 2026-08-10 | `pollo-entitlement-e2e-retry-20260810.yml` |  | 1 |
| Pollo Production Certification | `pollo-production-certification.yml` |  | 1 |
| Pollo Production E2E Once 2026-08-10 | `pollo-production-e2e-once-20260810.yml` |  | 1 |
| PR Automation | `pr-automation.yml` |  | 4 |
| Predictive Failure Detection (Manual Only) | `predictive-failure-detection.yml` |  | 1 |
| PRIMETIME Supabase Rollout | `primetime-supabase-rollout.yml` |  | 1 |
| Production Secret Preflight | `production-secret-preflight.yml` |  | 1 |
| Promotion Validation | `promotion-validation.yml` |  | 1 |
| Release | `release.yml` |  | 2 |
| Release Candidate Freeze | `release-candidate.yml` |  | 1 |
| Release Notes & Changelog Automation | `release-notes.yml` |  | 1 |
| Reproducible Builds (Manual Only) | `reproducible-builds.yml` |  | 1 |
| Reusable Node.js Setup | `reusable-node-setup.yml` |  | 1 |
| Run Final Voice Activation | `run-final-voice-activation.yml` |  | 1 |
| Runtime Recovery Validation | `runtime-recovery-validation.yml` |  | 1 |
| Runtime Validation Harness | `runtime-validation.yml` |  | 7 |
| SBOM & Supply Chain Security | `sbom.yml` |  | 4 |
| Secret Governance Audit | `secret-governance.yml` |  | 2 |
| Secret Scanning (Gitleaks) | `secret-scanning.yml` |  | 2 |
| Security Hardening | `security-hardening.yml` |  | 4 |
| Self-Documenting Platform | `self-documenting-platform.yml` |  | 1 |
| SLA Reporting & Compliance Certificates | `sla-reporting.yml` |  | 1 |
| Staging Release Gate (Manual Only) | `staging-release-gate.yml` |  | 1 |
| Stale PR Cleanup | `stale-pr-cleanup.yml` |  | 1 |
| Supabase Edge Functions | `supabase-edge-functions.yml` |  | 2 |
| Terraform AWS | `terraform-aws.yml` |  | 1 |
| Terraform Validation | `terraform-validation.yml` |  | 1 |
| Terraform Validation Pipeline | `terraform.yml` |  | 1 |
| Test Coverage | `coverage.yml` |  | 1 |
| Trusted Build Infrastructure (Manual Only) | `trusted-build.yml` |  | 1 |
| Trusted Runner Isolation | `trusted-runner-isolation.yml` |  | 2 |
| Usage Analytics Pipeline | `usage-analytics.yml` |  | 2 |
| Validate Action References | `validate-actions.yml` |  | 1 |
| Validate Required Secrets | `validate-secrets.yml` |  | 1 |
| Validate VPS deployment | `validate-vps-deploy.yml` |  | 1 |
| Vault-Backed Secrets Injection (Manual Only) | `vault-secrets-injection.yml` |  | 1 |
| Verify Vercel Build | `verify-vercel-build.yml` |  | 1 |
| Voice Certification Status Bridge | `voice-certification-status.yml` |  | 1 |
| Voice Live Browser Certification | `voice-live-browser-certification.yml` |  | 1 |
| Voice Studio Mount Guard | `voice-studio-mount.yml` |  | 1 |
| VPS Deploy — D3VONN.IO | `vps-deploy.yml` |  | 1 |
| Wave 30 Operational Convergence | `wave30-convergence.yml` |  | 1 |
| Workflow Audit Refresh Validation | `workflow-audit-refresh-validation.yml` |  | 1 |
| Workflow Optimizer | `workflow-optimizer.yml` |  | 1 |
| Zero-Downtime Migration | `zero-downtime-migration.yml` |  | 1 |

## Governance

- Generated documentation is published to `automation/self-documenting-platform`.
- Changes to `main` still require the repository normal pull-request and required-check path.
- Repository policy may prohibit GitHub Actions from creating pull requests; that policy does not make documentation generation itself fail.
