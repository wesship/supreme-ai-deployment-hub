# Governance

This directory contains governance policies, compliance frameworks, and operational
standards for the D3VONN platform.

## Structure

- Governance drift detection is enforced via `.github/workflows/governance-drift.yml`
- The lock manifest is maintained at `GOVERNANCE_LOCK_MANIFEST.md` (repository root)
- Security policies reside in `security/policy/`

## Policies

| Policy | Enforcement | Location |
|--------|-------------|----------|
| Commit conventions | CI (commitlint) | `commitlint.config.cjs` |
| Governance drift | CI (governance-drift) | `.github/workflows/governance-drift.yml` |
| Container hardening | CI (container-hardening) | `.github/workflows/container-hardening.yml` |
| Kubernetes admission | CI (kyverno) | `policy/kyverno/` |
| AI safety guardrails | CI (ai-safety) | `.github/workflows/ai-safety-guardrails.yml` |
| Secret scanning | CI (gitleaks) | `.github/workflows/secret-scanning.yml` |
