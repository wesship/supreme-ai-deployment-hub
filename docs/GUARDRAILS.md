# Devonn.ai Staging Guardrails

## Purpose

Staging proves build, deploy, health, readiness, queue, and observability behavior before any production rollout.

## Mandatory staging posture

```text
ENVIRONMENT=staging
AUTONOMY_MODE=guarded
EXECUTION_MODE=dry-run
```

## Default rule

Staging may plan and simulate work. Staging must not directly change production systems.

## Not allowed in staging by default

- direct production data changes
- direct production infrastructure changes
- direct production traffic changes
- direct pushes to the protected default branch
- irreversible external actions
- unattended release promotion

## Allowed in staging by default

- health checks
- readiness checks
- local compose validation
- preview deployments
- dry-run workflow planning
- synthetic queue messages
- staging-only data tests
- logs and telemetry collection
- human-reviewed pull requests

## Human approval gate

Any production-impacting action needs a separate approval path and rollback note.

Minimum approval record:

- requested action
- target environment
- rollback note
- approving human
- timestamp

## CI expectations

The staging CI gate verifies:

- required staging files exist
- compose syntax is valid
- local environment files are not committed
- guarded and dry-run defaults are present

## Runtime expectations

Services should emit structured logs when staging blocks a risky action.

Example shape:

```json
{
  "event": "staging_action_blocked",
  "environment": "staging",
  "mode": "guarded",
  "execution_mode": "dry-run",
  "reason": "production-impacting action is not allowed in staging"
}
```

## Promotion criteria

Staging is ready for production planning only when:

1. staging CI passes,
2. service health checks pass,
3. readiness checks pass where applicable,
4. no local environment file is committed,
5. risky actions are blocked and logged,
6. rollback steps are documented,
7. production deployment uses a separate runbook.
