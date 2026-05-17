# Security Policy

## Supported Versions

Currently, only the `main` branch (production) and the `develop` branch (staging) are actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| `develop`| :white_check_mark: |
| `< 1.0` | :x:                |

## Reporting a Vulnerability

We take the security of the Devonn.AI ecosystem seriously. If you discover a security vulnerability, please do **not** open a public issue.

Instead, please report it via one of the following methods:

1. **GitHub Security Advisories:** Navigate to the "Security" tab of this repository and click "Report a vulnerability".
2. **Direct Contact:** If you are a maintainer, contact the infrastructure team directly via internal channels.

### What to include in your report

- A description of the vulnerability and its impact.
- Steps to reproduce the issue (including any relevant code snippets or payloads).
- The affected component (e.g., Vite frontend, FastAPI backend, Terraform infrastructure, Supabase schema).
- (Optional) Suggested remediation or mitigation steps.

### Our Response Process

1. We will acknowledge receipt of your vulnerability report within 48 hours.
2. We will investigate the issue and determine its severity and impact.
3. If confirmed, we will develop a patch and apply it to the affected branches.
4. We will notify you when the patch is deployed and, if applicable, credit you in the release notes.

## Automated Scanning

This repository employs automated security scanning:
- **tfsec & checkov:** Scans Terraform infrastructure code for misconfigurations.
- **Snyk:** Scans Node.js dependencies for known vulnerabilities.
- **Dependabot:** Monitors `npm`, `pip`, and `github-actions` ecosystems for outdated or vulnerable packages.
- **CodeQL:** Performs static application security testing (SAST) on push.
