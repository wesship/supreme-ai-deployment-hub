# ADR-001: Domain-Driven Repository Structure

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-06-30 |
| Decision Makers | Platform Team |
| Supersedes | N/A |

## Context

The D3VONN repository grew organically from a marketing site into a full AI Business Operating System. By June 2026, the root directory contained 40+ directories and 73+ files with no clear organizational principle. Test files, infrastructure configs, documentation, and application code were intermixed at the top level, making navigation difficult for both humans and AI agents.

## Decision

Adopt a domain-driven directory structure where each top-level directory represents a bounded context of the platform. The structure groups files by their domain responsibility rather than their technical type.

The chosen layout is:

| Directory | Domain |
|-----------|--------|
| `agents/` | AI agent definitions, scaffolds, and benchmarks |
| `automation/` | Hermes governance engine and workflow orchestration |
| `backend/` | FastAPI production backend |
| `documentation/` | All human-readable documentation |
| `infrastructure/` | Deployment, K8s, Terraform, Helm, Docker |
| `integrations/` | SDKs, APIs, browser extension, MCP |
| `knowledge/` | DKOS memory and retrieval modules |
| `security/` | Compliance, governance, policies, protocols |
| `shared/` | Cross-cutting services used by multiple domains |
| `src/` | Frontend application (React/Vite) |
| `tests/` | All test suites consolidated |

## Consequences

**Positive consequences** include improved discoverability for new contributors, clearer ownership boundaries between teams, easier CI/CD scoping (only rebuild what changed), and better alignment with the seven-pillar product narrative.

**Negative consequences** include a large initial migration (548 files changed), potential for broken imports that require careful validation, and the need to update all documentation references. These costs are one-time and were mitigated by running full build, typecheck, lint, and test validation after the migration.

## Alternatives Considered

The monorepo-with-packages approach (using pnpm workspaces or Turborepo packages) was considered but rejected because the platform is not yet at the scale where independent versioning and publishing of sub-packages provides value. The domain-driven flat structure provides the organizational benefits without the tooling complexity.
