# Required Checks

This document records the repository’s protected-branch merge gates and the supporting open-source security controls. The authoritative enforcement configuration remains the GitHub ruleset for `main`; this document must be updated in the same pull request as a ruleset change.

## Required merge checks

The `main` ruleset currently requires the following checks before merge.

| Required check | Purpose |
|---|---|
| `Lint` | Checks maintained application source for lint regressions. |
| `Unit Tests (Node.js)` | Validates frontend and platform behavior. |
| `Backend Proxy Tests (FastAPI)` | Validates backend API routing and proxy security boundaries. |
| `Gitleaks Secret Scan` | Detects committed credentials and high-risk secret patterns. |

## Supporting security controls

The following controls remain part of the security baseline according to their existing workflow triggers and repository configuration. They are not replaced by a paid scanner or by a third-party status context.

| Control | Purpose |
|---|---|
| CodeQL | Performs static analysis and reports security findings to GitHub Security. |
| Dependency Review | Evaluates dependency changes in pull requests. |
| Anchore SBOM + Grype | Generates SPDX SBOMs and enforces high- and critical-severity vulnerability findings. |
| Container hardening | Validates container-hardening controls. |
| Application and security tests | Exercise application, backend, and security-specific regression boundaries. |
| Vercel and Railway deployment checks | Verify the normal Git-connected delivery path after the protected merge process. |

The authoritative control description is [Open-Source Security Baseline](../docs/security/OPEN_SOURCE_SECURITY_BASELINE.md).

## Branch protection settings

- Require pull request before merging: **Yes**.
- Require approvals and code-owner review: **Yes**, according to the active repository ruleset.
- Dismiss stale reviews on push: **Yes**.
- Require conversation resolution: **Yes**.
- Require linear history: **Yes**.
- Do not allow force pushes or branch deletion: **Yes**.
- Allowed merge methods: merge, squash, and rebase, according to the active ruleset.

## Change control

Modifying the required-check policy or a security workflow requires a pull request with platform and security review. Do not disable required checks, weaken branch rules, or add a credential-dependent scanner as an implicit production gate without an explicit policy decision.
