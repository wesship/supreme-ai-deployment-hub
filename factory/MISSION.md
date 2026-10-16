# Hermes AI Software Factory — Gate 1 Mission

Status: DESIGN ONLY / DISABLED. Tracking: #1425.

## Purpose
Translate a human-approved, bounded software epic into dependency-ordered issues, isolated implementation laps, independent verification, and a human-approved release decision.

## Non-negotiable boundaries
- Hermes remains the only scheduler and orchestration authority.
- No background dispatcher, cron job, auto-merge, or production deployment is enabled by this gate.
- No credentials, DNS, identity provider, schema, or branch protection modifications.
- Every lap has an owner, immutable issue reference, scope, budget, timeout, retry ceiling, and evidence URL.
- Agent-authored tests are not sufficient for acceptance; independent holdout scenarios must be maintained outside builder-visible workspaces.
- Fail closed on missing approvals, missing evidence, unknown status, or ambiguous task ownership.

## Existing assets to reuse
- `docs/hermes-distributed-workers.md`: deterministic worker registry and task leases.
- `docs/hermes-checkpoint-recovery.md`: checkpoint verification and safe replay.
- `package.json`: lint, typecheck, unit, e2e, security, and release-gate commands.

## Release policy
Human approval is required to accept the mission, approve the staging batch, and authorize any production release. A passing CI run is necessary but never sufficient. No code in this gate implements production execution.

## Gate acceptance
Audit baseline, scenarios, dependency graph, approval policy, and rollback procedure documented; draft PR opened. Actual lap execution and test evidence are separate later gates.
