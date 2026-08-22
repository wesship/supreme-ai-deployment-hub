# Devonn.AI System Architecture

**Version:** 2.0.0
**Last Updated:** 2026-05-16

This document describes the high-level architecture of the Devonn.AI platform — a multi-agent AI orchestration system built for autonomous deployment, monitoring, and self-healing of cloud infrastructure.

---

## System Overview

Devonn.AI is composed of five primary layers: the **Frontend**, the **Backend API**, the **Agent Mesh**, the **Data Layer**, and the **Infrastructure Layer**. These layers communicate through a combination of REST APIs, WebSockets, and a Redis-backed task queue.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                         │
│              React + TypeScript + Vite + TailwindCSS             │
│   Components: AdminDashboard, TaskQueue, FeatureFlagManager      │
│   Hooks: useAgentMesh, useWebSocket, useAgentHealth              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────────┐
│                    Backend API (FastAPI)                          │
│                    Python 3.11 + Uvicorn                         │
│  /api/v1  — Agents, Tasks, Feature Flags                        │
│  /api/v2  — Streaming, Advanced Orchestration                   │
│  /ws      — Real-time WebSocket connections                      │
│  Middleware: CORS, RateLimit, Logging, MultiTenancy, JWT Auth   │
└──────┬────────────────────────────────────┬──────────────────────┘
       │                                    │
┌──────▼──────────────┐          ┌──────────▼──────────────────────┐
│    Agent Mesh        │          │        Task Queue (Redis)        │
│  agent_mesh.py       │          │  Celery workers + Redis broker   │
│  router.py           │          │  Tasks: deploy, scan, heal       │
│  Multi-agent comm    │          └─────────────────────────────────┘
└──────┬──────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                        Data Layer                                 │
│  Supabase (PostgreSQL + RLS)  │  Redis Cache  │  AWS S3 Assets   │
│  asyncpg connection pool      │  TTL-based    │  Terraform state  │
└──────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                           │
│  AWS EKS (Kubernetes)  │  Helm Charts  │  Terraform              │
│  cert-manager (TLS)    │  External Secrets Operator              │
│  Prometheus + Grafana + Loki + Sentry (Observability)           │
│  Falco (Runtime Security)  │  OPA (Policy Enforcement)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Frontend | React + Vite + TailwindCSS | User interface, agent monitoring, admin controls |
| Backend API | FastAPI + Python 3.11 | REST/WebSocket API, auth, middleware, orchestration |
| Agent Mesh | Python (agent_mesh.py) | Multi-agent communication and task routing |
| Task Queue | Redis + Celery | Async background job execution |
| Database | Supabase (PostgreSQL) | Persistent data with Row-Level Security |
| Cache | Redis | Session cache, rate limiting, feature flags |
| Infrastructure | AWS EKS + Helm | Container orchestration and scaling |
| Secrets | External Secrets Operator | Sync AWS Secrets Manager → K8s Secrets |
| Observability | Prometheus + Grafana + Loki | Metrics, dashboards, log aggregation |
| Security | Falco + OPA + CodeQL + Dependency Review + Gitleaks + Grype | Runtime, policy, SAST, secret detection, SBOM, and dependency vulnerability security |

---

## Authentication & Authorization

All API endpoints are protected by JWT authentication. Tokens are issued by the backend's `/api/v1/auth/token` endpoint and validated on every request via the `JWTAuthMiddleware`. Row-Level Security (RLS) policies in Supabase enforce data isolation at the database level, ensuring tenants can only access their own data.

---

## Multi-Tenancy

The `MultiTenancyMiddleware` extracts the `X-Tenant-ID` header from every inbound request and attaches it to the request context. All database queries are scoped to the tenant ID, enforced by Supabase RLS policies defined in `supabase/migrations/`.

---

## CI/CD Pipeline

The repository uses GitHub Actions for all CI/CD operations. The pipeline consists of 36 workflows covering build, test, lint, security scanning, deployment, and observability. Key workflows include:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR, push to main | TypeScript typecheck, ESLint, production build |
| `testing.yml` | PR, push to main | Unit tests (Vitest), Python tests (pytest), and a pnpm dependency audit |
| `deploy.yml` | Push to main | Vercel production deployment |
| `codeql.yml` | PR, schedule | SAST security analysis |
| `dependency-review.yml` | PR | Dependency-change review before merge |
| `secret-scanning.yml` | PR, push to main | Gitleaks secret detection |
| `grype.yml` | Dependency changes, schedule | SPDX SBOM generation and high/critical vulnerability enforcement |
| `final-green-check.yml` | PR to main | Pre-merge validation gate |

---

## Data Flow: Agent Task Execution

1. A user submits a task via the Admin Dashboard (`POST /api/v1/tasks`).
2. The backend validates the request, applies rate limiting, and enqueues the task in Redis.
3. A Celery worker picks up the task and routes it to the appropriate agent via the Agent Mesh.
4. The agent executes the task (e.g., deploy, scan, heal) and publishes status updates via WebSocket.
5. The frontend receives real-time updates through the `useWebSocket` hook and renders them in the TaskQueue component.
6. Task results and audit logs are persisted to Supabase.

---

## Security Architecture

Security is enforced at every layer. The frontend uses Content Security Policy headers and environment variable validation (`src/lib/env.ts`). The backend enforces JWT authentication, rate limiting, and multi-tenancy isolation. Kubernetes workloads run as non-root with read-only root filesystems. OPA policies enforce compliance rules on AWS resources. Falco monitors runtime behaviour for anomalies. All secrets are managed through AWS Secrets Manager and synced to Kubernetes via the External Secrets Operator — no secrets are ever stored in the repository.

---

## Related Documents

- [Production Runbook](./runbooks/common_issues.md)
- [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
- [Deployment Guide](./DEPLOYMENT-GUIDE.md)
- [OpenAPI Specification](./api/openapi.yaml)
- [CHANGELOG](./CHANGELOG.md)
