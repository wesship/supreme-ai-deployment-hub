# Operational Compression Plan

## Purpose

This plan reduces D3VONN operational entropy before production hardening continues.

The goal is to make the platform easier to deploy, observe, recover, and govern.

## Core Principle

Simplification now increases power.

Do not add new major frameworks, agents, dashboards, or infrastructure targets until the current runtime is observable and recoverable.

## Workflow Consolidation Target

Move toward a smaller authoritative CI/CD set:

- core-ci.yml
- deploy.yml
- promotion.yml
- terraform.yml
- security.yml
- observability.yml
- incident-response.yml

All other workflows should be classified as:

- required
- advisory
- scheduled
- experimental
- deprecated

## Service Boundary Target

Target structure:

```text
/apps
  /frontend
  /api
  /dashboard

/services
  /scheduler
  /workers
  /orchestrator
  /replay-engine
  /intelligence

/packages
  /shared-types
  /governance
  /telemetry
  /queue-core

/infrastructure
/observability
/tools
/docs
```

## Compression Priorities

1. Reduce duplicate workflows.
2. Separate validation from deployment.
3. Keep production deploy paths narrow.
4. Keep wave and PR branches validation-only.
5. Remove ambiguous root-level runtime signals.
6. Separate frontend, backend, tooling, and infrastructure responsibilities.
7. Require observability before autonomy expansion.

## Stop Conditions

Pause new feature work if:

- CI has skipped/no-job checks
- queue recovery is unverified
- telemetry coverage is incomplete
- deployment paths conflict
- production/staging secrets are ambiguous
- workflows duplicate responsibility

## Next Implementation Targets

- workflow inventory and classification
- service-boundary map
- queue runtime implementation plan
- telemetry wiring checklist
- staging resilience checklist

## Production Readiness Rule

D3VONN should not scale production autonomy until operational compression, runtime observability, retry governance, stale recovery, and rollback confidence are proven in staging.
