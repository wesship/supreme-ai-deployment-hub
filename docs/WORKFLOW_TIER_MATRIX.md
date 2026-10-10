# DEVONN.AI Workflow Tier Matrix

## Purpose

This document classifies workflows by operational criticality.

The objective is to reduce CI entropy and establish deterministic production gates.

---

# Tier 1 — Production Blocking

These workflows are authoritative release gates.

| Workflow | Purpose |
|---|---|
| build.yml | Core build validation |
| trusted-build.yml | Trusted production build enforcement |
| reproducible-builds.yml | Artifact reproducibility validation |
| codeql.yml | Security analysis |
| lockfile-integrity.yml | Dependency integrity enforcement |
| validate-actions.yml | Workflow validation |
| e2e.yml | Critical end-to-end runtime validation |
| cosign-sign-verify.yml | Artifact signing + verification |

---

# Tier 2 — Advisory / Quality

These workflows improve operational quality but should not always block feature development.

| Workflow | Purpose |
|---|---|
| accessibility.yml | Accessibility regression checks |
| lighthouse.yml | Frontend quality and performance |
| performance-regression.yml | Runtime performance drift detection |
| container-hardening.yml | Container baseline analysis |
| notifications.yml | Runtime alerting and notifications |
| developer-onboarding.yml | Contributor environment validation |

---

# Tier 3 — Heavy / Scheduled / Experimental

These workflows are resource-intensive or intended for scheduled validation.

| Workflow | Purpose |
|---|---|
| trusted-runner-isolation.yml | Runner isolation validation |
| ai-model-pipeline.yml | AI pipeline orchestration |
| azure-container-apps-deploy.yml | Alternative deployment validation |

---

# Wave 30 Goals

Wave 30 should reduce ambiguity around:

- which workflows block production
- which workflows are advisory
- which workflows are experimental
- which workflows are deprecated

---

# Future Direction

Future waves should consolidate overlapping workflows where possible.

Target outcome:

- fewer workflows
- clearer contracts
- lower CI cost
- lower operational entropy
- deterministic promotion behavior
