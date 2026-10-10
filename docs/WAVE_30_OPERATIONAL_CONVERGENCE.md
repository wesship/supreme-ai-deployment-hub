# Wave 30 — Operational Convergence Contract

## Purpose

Wave 30 converts DEVONN.AI from a high-power multi-layer platform into a cohesive operational system. The goal is not to add new capability. The goal is to reduce ambiguity, collapse drift, and make the existing system easier to validate, deploy, observe, and recover.

## Operating Principle

No new major framework, agent family, deployment target, or governance abstraction should be added during this wave unless it directly removes operational risk.

Wave 30 is a convergence wave.

## Completion Gates

Wave 30 is considered complete when the repository can answer these questions deterministically:

1. Which workflows are required for production readiness?
2. Which workflows are advisory, experimental, nightly, or release-only?
3. Which service owns each runtime boundary?
4. Which health endpoints must exist for each service?
5. Which environment variables are required for staging and production?
6. Which deployment path is authoritative?
7. Which rollback path is authoritative?
8. Which logs and metrics prove that the runtime is healthy?

## Required Workflow Tiers

### Tier 1 — Required Gates

These workflows block release candidates and production promotion.

Recommended categories:

- build
- test
- typecheck
- lint
- lockfile integrity
- secret scan
- production readiness
- deployment contract validation

### Tier 2 — Advisory Gates

These workflows inform release quality but should not block every feature branch unless the branch modifies the relevant subsystem.

Recommended categories:

- accessibility
- performance regression
- lighthouse
- container hardening
- code quality reports
- workflow audit reports

### Tier 3 — Scheduled / Heavy Gates

These workflows should run nightly, on demand, or before major releases.

Recommended categories:

- chaos engineering
- reproducible builds
- trusted runner isolation
- full SBOM verification
- policy replay
- autonomous runtime validation
- long-running E2E flows

## Canonical Service Boundaries

The target operational layout remains:

```text
/services/frontend
/services/api
/services/orchestrator
/services/workers
/infra
/observability
/governance
/scripts
/docs
```

Each service must eventually define:

- owner
- entrypoint
- Dockerfile or deploy adapter
- health contract
- readiness contract
- metrics contract
- environment contract
- rollback notes

## Health Contract

Every long-running service should expose or provide an equivalent probe for:

```text
/health   — process is alive
/ready    — dependencies are reachable enough to serve traffic
/metrics  — Prometheus-compatible metrics or documented equivalent
/version  — build SHA, release version, environment, and runtime mode
```

For frontend-only services, static equivalents are acceptable when documented.

## Environment Contract

Wave 30 should converge scattered configuration into one canonical contract:

- `.env.example` for safe placeholders
- `.env.contract` or equivalent schema for required variables
- startup validation for backend/runtime services
- no real secrets committed
- no frontend exposure for server-only keys

## Deployment Contract

Authoritative deployment flow:

```text
feature branch
  → pull request
  → staging validation
  → canary validation
  → production promotion
```

Non-authoritative deployment paths should be documented as deprecated, experimental, or local-only.

## Rollback Contract

Every production promotion must identify:

- previous artifact or image
- previous infrastructure revision
- database rollback or forward-fix policy
- queue replay behavior
- manual break-glass process

## Observability Contract

Minimum required visibility:

- API latency
- API error rate
- scheduler lag
- queue depth
- failed job count
- retry count
- dead-letter count
- memory/replay validation status
- deployment version
- active runtime mode

## Wave 30 Deliverables

- Operational convergence contract
- Repository convergence check script
- CI gate for convergence drift
- Workflow tiering inventory
- Service boundary inventory
- Health/ready/metrics/version contract tracking
- Remaining Wave 31 handoff notes

## Wave 31 Handoff

When Wave 30 is complete, Wave 31 should begin production freeze preparation:

- release branch policy
- immutable artifact policy
- production promotion rules
- rollback drill proof
- governance freeze manifest
