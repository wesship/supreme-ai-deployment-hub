# Gate 13 — security review evidence and decision

Status: **HOLD — independent review not performed**.

Target: draft PR #1428, experimental CPU-only text engine.

## Automated evidence
- Dedicated CPU test workflow: successful on commit ab228715062db32715eb8270c35da6ae5fa100a8.
- Security Hardening: successful on that commit.
- Required PR Gate: successful on that commit.
- These checks are not substitutes for independent review or a staging pilot.

## Security findings requiring resolution
1. **High — identity and data isolation:** one process-wide bearer token protects a shared in-memory corpus. Tenant ID is validated at startup but not bound to each request. Only an isolated, dedicated staging process may be considered; no multi-user exposure.
2. **High — protocol:** HTTP handler is MCP-shaped JSON-RPC, not verified against a conforming MCP client or full MCP transport/session requirements. Do not advertise as production MCP.
3. **Medium — request lifetime:** socket timeout is not an end-to-end execution deadline. Slow and truncated requests need adversarial tests.
4. **Medium — secrets and transport:** token rotation, trusted TLS ingress, audit logging and log redaction not certified.
5. **Medium — resource exhaustion:** process-local fixed-window limiter, thread-per-connection HTTP server, corpus caps per document but no total-memory quota. Add global budget and connection limits.
6. **Medium — input data:** command-line CUDA prototype exposes text in process listings; do not run on private datasets.
7. **Low — benchmark:** synthetic benchmark is not a real workload or GPU comparison.

## Certification requirements
- Independent reviewer records verdict and evidence on exact commit.
- Fix high findings or enforce documented staging-only compensating controls.
- Demonstrate real HTTP 401/403/404/413/429/503, malformed bodies, timeout and rollback behavior.
- Provision secret and tenant identity in approved staging secret manager; do not store credentials in repository.
- Run an authenticated Hermes-to-worker smoke test and negative authorization test.
- Attach redacted evidence and obtain explicit owner approval before promotion.

No staging deployment, independent approval, or GPU hardware certification is claimed here.
