# D3VONN Platform Architecture — Current Version

> **Architecture Version:** 2.0  
> **Effective Date:** June 30, 2026  
> **Status:** Active

## Overview

D3VONN is an AI Business Operating System built around seven pillars. The architecture follows a domain-driven design with clear separation of concerns, event-driven communication, and policy-based governance.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     D3VONN Platform Console                       │
│  (React/Vite Frontend — src/)                                    │
├─────────────────────────────────────────────────────────────────┤
│                        API Gateway                                │
│  (FastAPI Backend — backend/)                                    │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│  Hermes  │   DKOS   │  Agent   │ Security │    Automation       │
│  Kernel  │ Knowledge│  Fleet   │  Center  │    Engine           │
│          │    OS    │          │          │                     │
├──────────┴──────────┴──────────┴──────────┴─────────────────────┤
│                      Event Bus                                    │
│  (Standardized Events — automation/workflows.yaml)               │
├─────────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                            │
│  (K8s / Terraform / Helm / Supabase)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Seven Pillars

| Pillar | Purpose | Primary Location |
|--------|---------|-----------------|
| Hermes | Orchestration kernel | `automation/hermes/` |
| DKOS | Knowledge operating system | `knowledge/` |
| AI Workforce | Specialist agents | `agents/` |
| Automation | Workflow execution | `automation/` |
| Security | Command center | `security/` |
| Developer Platform | SDKs and integrations | `integrations/` |
| Enterprise Governance | Multi-tenant, RBAC | `backend/app/middleware/` |

## Key Design Decisions

All architectural decisions are recorded as ADRs in `architecture/v2.0/decisions/`.

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Domain-driven repository structure | Accepted |
| ADR-002 | Agent manifest system for dynamic discovery | Accepted |
| ADR-003 | Event-driven architecture with standardized events | Accepted |
| ADR-004 | Registry-based service discovery | Accepted |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python 3.11+, FastAPI, Pydantic |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (JWT, RBAC) |
| Infrastructure | Kubernetes, Terraform, Helm, Docker |
| CI/CD | GitHub Actions |
| Observability | OpenTelemetry, Prometheus, Grafana |
| Security | OPA, Falco, Kyverno, Tetragon, Seccomp |
| Models | OpenAI GPT-4o, Anthropic Claude, Hugging Face |

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 2.0 | 2026-06-30 | Domain-driven restructure, registries, manifests, ADRs |
| 1.0 | 2025-12-01 | Initial platform architecture |
