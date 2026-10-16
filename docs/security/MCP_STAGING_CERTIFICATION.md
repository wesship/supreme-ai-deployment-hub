# D3VONN MCP staging certification gates

Status: HOLD — this document is a checklist, not evidence of passing tests.

## Existing surfaces
- Lovable MCP server: `src/lib/mcp-server/index.ts` (three read-oriented marketplace tools)
- Bundled Supabase MCP function: `supabase/functions/mcp/index.ts`
- HNF JSON-RPC bridge: `backend/hnf/router.py`
- Client and tool allowlist: `src/lib/mcp/`

## Gate 1: Inventory and protocol compatibility
- [ ] Confirm deployed endpoint URL and environment for each server; never infer deployment from source files.
- [ ] Test initialize, protocol version negotiation, capabilities, tools/list, tools/call, and malformed JSON-RPC.
- [ ] Verify compatibility with supported remote MCP transports and client authentication.
- [ ] Separate the HNF JSON-RPC subset from a fully conforming MCP transport.

## Gate 2: Identity and authorization
- [ ] Verify JWT signature, issuer, audience, expiry, and user-scoped Supabase RLS.
- [ ] Derive actor and tenant from verified credentials, never from caller-supplied actor_id.
- [ ] Reject cross-tenant reads and writes; test revoked and expired tokens.
- [ ] Bind human approvals to actor, tenant, exact operation and payload digest, with expiry and one-time consumption.
- [ ] Verify the HNF service key does not grant blanket authority to impersonate or approve.

## Gate 3: Safe execution
- [ ] Keep Hermes/TARS write tools and production worker activation disabled by default.
- [ ] Apply tool-specific scopes, allowlists, input validation, idempotency, cost budgets and rate limits.
- [ ] Audit tool discovery, calls, denied actions, and approval decisions without leaking secrets.
- [ ] Ensure failures are explicit; no silent fallback to privileged credentials.

## Gate 4: Testing and release
- [ ] Add protocol contract, negative authorization, replay, timeout, and tenant-isolation tests.
- [ ] Run targeted unit/integration tests, typecheck, lint, dependency audit and existing regression suites.
- [ ] Confirm staging URL, deployed commit, and real authenticated client interoperability.
- [ ] Review CI, security scans, migration effects and operational rollback.
- [ ] Obtain explicit release approval before merging or enabling production execution.

## Findings requiring special attention
The HNF `/mcp` route accepts `actor_id` from request arguments and defaults to `hnf-mcp`; verify downstream authorization is not based on this untrusted string. Its `tools/list` and `tools/call` JSON-RPC methods alone do not prove full MCP transport compliance.

No secrets should be committed. No production deployment, workflow execution, or approval bypass is authorized by this document.
