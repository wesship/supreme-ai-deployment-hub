# D3VONN.IO Greptile Review Policy

Greptile is an independent validation layer, not an authority to bypass repository governance.

## Review priorities

Focus first on production safety, security boundaries, data integrity, API compatibility, deployment correctness, and cross-service regressions. Prefer concrete defects and realistic failure paths over style-only feedback.

## Production safety

Treat authentication, secrets, database migrations, infrastructure, CI/CD, billing, financial operations, public APIs, and production agent actions as sensitive. These areas require explicit human review even when automated review is clean.

Never recommend bypassing protected environments, CODEOWNERS, required checks, security scans, migration preview/apply controls, or deployment verification merely to make a pull request mergeable.

## Architecture expectations

D3VONN.IO is a multi-service AI platform. Review changes in their wider context, including frontend callers, FastAPI services, Supabase data contracts, Hermes/agent orchestration, external integrations, and deployment workflows.

When a change modifies a shared contract, search for downstream callers and flag inconsistent updates. When an agent can mutate an external system, verify that authorization, idempotency where needed, logging/auditability, and fail-safe behavior remain intact.

## Security expectations

Never expose real secrets in source, logs, fixtures, comments, generated artifacts, examples, or error payloads. Verify that privileged routes and internal operations remain fail-closed and that input validation is performed at trust boundaries.

Security-sensitive changes should include focused validation. A passing happy-path test is not sufficient when an authorization or privilege boundary changed.

## Database and migration expectations

Supabase migrations must preserve production data and the governed rollout process. Flag destructive SQL, unsafe defaults, unbounded data rewrites, missing rollback/repair considerations, and code that assumes a migration has already been applied when deployment ordering is not guaranteed.

## Agent and automation expectations

Builder agents may propose changes; verification must remain independent. No agent should certify its own production mutation merely because it generated the code. Mutating actions need a clear authorization boundary and should be auditable.

## Review signal

P0/P1-class findings should identify a concrete production, security, data-loss, financial, or availability risk. Medium findings should represent real correctness or maintainability risks with a plausible failure path. Avoid speculative nitpicks that do not affect behavior or repository policy.
