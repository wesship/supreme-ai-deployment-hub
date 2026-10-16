# Opportunity Intelligence — REA Gate 1

Status: DISABLED / DESIGN ONLY. No REA binary is installed or executed by this change.

## Existing integration points
- Hermes persistent worker leasing and checkpoint recovery
- `backend/hnf/router.py` MCP boundary
- `src/lib/mcp/client.ts` MCP client
- `src/lib/featureFlags.ts` remote feature flags

## Security contract
1. `OPPORTUNITY_REA_ENABLED` defaults to false. A missing or malformed value means disabled.
2. Run any authorized analysis in a separate, ephemeral worker without production credentials, host mounts, or unrestricted network access.
3. Require a per-job user approval tied to immutable artifact digest, scope, expiration, and requester identity.
4. Reject unknown targets, unapproved uploads, secret-containing inputs, and attempts to access systems without authorization.
5. Apply CPU, memory, time, filesystem and output limits; maintain a durable audit trail.
6. Treat analysis output as untrusted; never execute generated commands or code automatically.
7. Keep marketplace publication, external MCP exposure, and production execution disabled until separately reviewed.

## Acceptance tests to implement before enabling
- Default-off and malformed-flag fail-closed behavior
- Approval binding, expiration, revocation, and tenant isolation
- No credentials or filesystem mounts leaked to worker
- Timeout, cancellation, idempotency, output-size limits
- Worker crash recovery and audit record completeness
- License provenance and explicit authorization checks
- Regression tests for existing Hermes and MCP routes

## Rollout sequence
1. Review this design and identify the correct worker interface.
2. Add a typed request schema and disabled-by-default adapter.
3. Add isolated mocked tests; do not run REA on real targets.
4. Open a draft PR and run CI.
5. Only after security review, enable in staging for an authorized sample.
