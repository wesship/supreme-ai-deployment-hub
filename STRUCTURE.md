# D3VONN.IO — Repository Structure

> This document describes the domain-driven directory layout introduced in the v2.0 modernization effort.

## Top-Level Layout

```
.
├── agents/              — Agent mesh scaffolds, devonnbench, AI models
├── automation/          — Hermes governance engine (orchestration kernel)
├── backend/             — FastAPI production backend (Python)
├── documentation/       — All docs, guides, runbooks, and blueprints
├── infrastructure/      — Deployment: K8s, Terraform, Helm, GitOps, Docker, platforms
├── integrations/        — SDK, API specs, browser extension, MCP
├── knowledge/           — DKOS memory and knowledge modules
├── public/              — Static assets served by Vite
├── scripts/             — CI scripts, migration tools, auditing utilities
├── security/            — Compliance, governance, policy, protocols
├── shared/              — Shared services (intelligence, runtime-recovery)
├── src/                 — Vite/React frontend application (TypeScript)
├── supabase/            — Supabase migrations, edge functions, config
├── templates/           — Service scaffolding templates
└── tests/               — Consolidated test suites (e2e, load, stress, contract)
```

## Domain Mapping

| Domain | Directory | Description |
|--------|-----------|-------------|
| Frontend | `src/` | Vite + React + TypeScript + Tailwind + shadcn/ui |
| Backend | `backend/` | FastAPI + Supabase + multi-tenant auth |
| Agents | `agents/` | Agent mesh scaffolds, benchmark harness, model configs |
| Knowledge (DKOS) | `knowledge/` | Memory, ingestion, semantic search modules |
| Security | `security/` | Compliance (SOC2), governance, OPA/Falco/Kyverno policies |
| Automation | `automation/` | Hermes governance engine (v3) |
| Infrastructure | `infrastructure/` | K8s manifests, Terraform, Helm charts, Docker, GitOps |
| Integrations | `integrations/` | SDK, OpenAPI spec, Chrome extension |
| Shared | `shared/` | Cross-cutting services (intelligence, runtime recovery) |
| Tests | `tests/` | All test suites consolidated |
| Documentation | `documentation/` | Guides, runbooks, blueprints, changelogs |

## Key Configuration Files (Root)

| File | Purpose |
|------|---------|
| `package.json` | Node.js workspace config (`@d3vonn/platform`) |
| `pyproject.toml` | Python project config (`d3vonn-platform`) |
| `vite.config.ts` | Vite bundler configuration |
| `tailwind.config.ts` | Tailwind CSS theme |
| `tsconfig.json` | TypeScript compiler options |
| `eslint.config.js` | ESLint rules |
| `vitest.config.ts` | Unit test runner config |
| `playwright.config.ts` | E2E test config |
| `turbo.json` | Turborepo pipeline config |
| `pnpm-workspace.yaml` | PNPM workspace definition |

## v2.0 Pillars → Code Locations

| Pillar | Primary Location | Supporting |
|--------|-----------------|------------|
| Hermes Orchestration | `automation/hermes/` | `backend/hermes/` |
| DKOS Knowledge OS | `knowledge/` | `backend/knowledge/`, `src/pages/DkosIngestion.tsx` |
| AI Workforce | `agents/` | `backend/agents/`, `src/pages/AIAgents.tsx` |
| Automation Engine | `automation/` | `src/pages/WorkflowManagement.tsx` |
| Security Command Center | `security/` | `backend/security/`, `src/pages/Security.tsx` |
| Developer Platform | `integrations/` | `documentation/`, `backend/api/` |
| Enterprise Governance | `backend/app/middleware/` | `security/governance/` |
