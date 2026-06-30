# Security Policy

D3VONN.IO is an AI Business Operating System for supervised agent execution, workflow automation, persistent knowledge, and command-center visibility.

## Supported branches

Currently supported:

| Branch | Purpose | Supported |
| --- | --- | --- |
| `main` | Production | Yes |
| `develop` | Staging, when active | Yes |
| Legacy branches | Historical work | No |

## Reporting a vulnerability

Please do **not** open a public issue for security concerns.

Preferred reporting channels:

1. GitHub Security Advisories: use the repository Security tab and choose “Report a vulnerability.”
2. Email: security@d3vonn.io

Please include:

- Affected URL, endpoint, component, or package
- Reproduction steps
- Expected impact
- Screenshots, logs, or proof-of-concept details when safe to share
- Suggested remediation, if known
- Your preferred contact information

## Scope

In scope:

- Public D3VONN.IO web surfaces
- Authentication and authorization issues
- Server-side API boundary issues
- Data exposure, RAG/memory exposure, or agent-run leakage
- Security header or routing misconfiguration
- Dependency vulnerabilities with practical exploit paths
- Supabase, FastAPI, Vite, Railway, Vercel, and GitHub Actions misconfigurations

Out of scope:

- Social engineering
- Physical attacks
- Denial-of-service load testing without written permission
- Automated scans that create noise or degrade service
- Issues requiring compromised third-party accounts
- Theoretical findings without a practical exploit path

## Current security posture

The platform is being built around:

- HTTPS-only production delivery
- Server-side API proxy boundaries
- Private provider-key handling
- Protected authenticated routes
- CSP and HSTS hardening path
- Auditability for agent runs, task checkpoints, and supervised approvals
- Enterprise roadmap for SSO, RBAC, SCIM, audit-log exports, and SOC 2 readiness

## Response process

1. We aim to acknowledge valid reports promptly.
2. We triage severity and business impact.
3. We prepare, test, and deploy a fix.
4. We notify the reporter when the issue is remediated.
5. We credit researchers when appropriate and requested.

## Automated scanning

The repository uses or is designed to support automated security scanning across:

- GitHub Dependabot
- GitHub code scanning / CodeQL
- Node.js dependency checks
- Python dependency checks
- Infrastructure configuration checks

## Responsible disclosure

Do not publicly disclose vulnerabilities until the team has had a reasonable opportunity to investigate and remediate.
