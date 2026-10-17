# Gate 11–14 staging certification checklist

Status: NOT CERTIFIED. This checklist is not evidence of live staging tests.

## Gate 11: HTTP and overload validation
- Run all `test_*.py` tests in GitHub Actions.
- Test real loopback HTTP 401, 404, 400, 413, 429 and 503 responses.
- Use deterministic clock and concurrency barriers to verify 60/minute and single-flight behavior.
- Add malformed Content-Length, truncated body, slow-client and connection-disconnect cases.
- Confirm socket timeout does not masquerade as an end-to-end execution deadline.

## Gate 12: independent security review
- Review shared in-memory corpus isolation: **do not** permit multiple untrusted tenants to share one Worker.
- Review authentication: process-local static bearer token, no rotation or identity scoping yet.
- Validate body-size caps, log redaction, TLS at a trusted ingress, and abuse controls.
- Validate protocol compliance with an actual MCP client before calling this an MCP server.
- Block production until isolation, identity, request lifecycle and protocol issues are resolved.

## Gate 13: Hermes staging pilot (requires authorization)
- Create a staging-only, private worker deployment with no GPU enabled.
- Provision scoped secret through the approved secret manager; never commit tokens.
- Restrict access to the staging Hermes service identity; verify positive and negative auth cases.
- Check provenance offsets, data retention, telemetry, rollback, and removal of staging data.
- Attach redacted evidence to PR #1428.

## Gate 14: release decision
- All checks green on exact release SHA, independent security approval and owner sign-off.
- Rollback rehearsed and documented.
- Keep experimental CUDA disabled until physical hardware parity and benchmarks pass.
- No production deployment or PR merge without explicit approval.
