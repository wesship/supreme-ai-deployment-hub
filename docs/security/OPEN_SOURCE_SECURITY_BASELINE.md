# Open-Source Security Baseline

## Purpose

D3VONN.IO uses a repository-native and open-source security baseline for normal build, review, and deployment work. This policy removes the repository’s dependency on the retired commercial scanner’s actions, credentials, bot automation, and release exceptions. It does not weaken branch protections, required tests, secret scanning, or deployment controls.

> **Scope boundary:** This document governs repository-managed workflows and documentation. An external GitHub App can still publish its own status context until a repository or organization administrator disconnects that App in GitHub.

## Control stack

| Layer | Control | Purpose | Enforcement state |
|---|---|---|---|
| Source analysis | CodeQL | Analyze code for security vulnerabilities and publish findings to GitHub Security. | Existing workflow and GitHub Security integration. |
| Dependency review | GitHub Dependency Review | Evaluate dependency changes in pull requests before merge. | Existing workflow. |
| Secret detection | Gitleaks | Detect committed credentials and high-risk secret patterns. | Required pull-request check. |
| SBOM and vulnerability analysis | Anchore SBOM + Grype | Generate an SPDX SBOM, scan for vulnerabilities, fail on high or critical findings, preserve artifacts, and upload SARIF when available. | Existing scheduled and dependency-change workflow. |
| Container posture | Container hardening | Validate repository container-hardening controls. | Existing workflow. |
| Application assurance | Lint, Node unit tests, Python/backend proxy tests, and security-focused test suites | Validate application behavior and regression boundaries. | Required branch checks and existing test workflows. |
| Deployment verification | Vercel and Railway deployment checks | Build the frontend preview and verify deployment readiness through the normal Git-connected delivery path. | Existing deployment integrations. |

## Required branch protections

The `main` ruleset currently requires the following checks before protected-branch merge:

| Required check | Security relevance |
|---|---|
| `Lint` | Prevents regressions in maintained application source. |
| `Unit Tests (Node.js)` | Validates frontend and platform behavior. |
| `Backend Proxy Tests (FastAPI)` | Validates backend API routing and proxy security boundaries. |
| `Gitleaks Secret Scan` | Prevents credential leakage into the repository. |

These required checks remain unchanged by the Snyk retirement. CodeQL, dependency review, Grype, container hardening, and other security workflows remain in place according to their existing triggers and repository configuration.

## Dependency-update policy

Dependabot remains the only dependency-update bot that the repository’s native auto-merge workflow considers. Automatic merge still depends on the repository’s review and required-check protections; this policy does not grant a bot authority to bypass those controls.

## Credential policy

The retired scanner credential is no longer a repository-required, optional, bootstrap, or cataloged CI credential. If a legacy credential remains in GitHub Secrets after this change, it is unused by the repository and may be removed by an authorized administrator after the pull request is merged and the resulting workflows have completed successfully.

## Operational procedure

When a security finding is raised, triage it using the system that produced the finding, verify the affected component and available fix, add or update a regression test where feasible, and ship the remediation through the protected pull-request process. Do not disable required checks or treat a third-party billing issue as a reason to weaken the open-source controls listed above.

## External integration retirement

Removing repository code and workflows cannot uninstall an external GitHub App. To stop an external scanner status from appearing, an administrator must remove or disconnect that App at the repository or organization scope. This is an administrative integration action, not a source-code change.
