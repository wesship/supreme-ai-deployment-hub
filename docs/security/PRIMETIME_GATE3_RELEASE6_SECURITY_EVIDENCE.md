# PRIMETIME Gate 3 / Release 6 Security Evidence

Date: 2026-09-06
Environment: Supabase staging `ypomzwhtaamxdmcwtpyf`
Scope: RLS/service-only classification, credential-secret exposure, workspace isolation, privileged RPC review, release-gate evidence.

## Result

**Gate 3 staging security: PASS.**

Production database promotion is intentionally separate from this staging certification.

## Applied staging migration

`20260906145502_gate3_explicit_service_only_and_credential_column_hardening.sql`

The migration:

1. Makes these backend/service-only tables explicit deny-all surfaces for browser roles and service-role-only for direct table access:
   - `aquagov_workers`
   - `jetson_command_audit`
   - `jetson_commands`
   - `jetson_devices`
   - `jetson_telemetry`
   - `quantum_optimization_experiments`
   - `quantum_optimization_metrics`
2. Removes authenticated/anonymous access to secret columns on:
   - `api_connections.credentials`
   - `cloud_credentials.credentials`
   - `mcp_connections.api_token_encrypted`
3. Preserves authenticated read access to non-secret metadata through security-invoker safe views and column-level grants.
4. Restricts credential ownership policies to `authenticated` and adds `WITH CHECK` to update policies so ownership cannot be reassigned.

## Verification evidence

### Service-only tables

Post-migration catalog verification showed, for all seven service-only tables:

- `anon SELECT = false`
- `authenticated SELECT = false`
- `service_role SELECT = true`
- exactly one explicit `Deny direct browser access` RLS policy

This resolved every previous `rls_enabled_no_policy` Security Advisor finding.

### Credential boundary

Post-migration privilege verification showed:

- `authenticated` cannot `SELECT` `api_connections.credentials`
- `authenticated` cannot `SELECT` `cloud_credentials.credentials`
- `authenticated` cannot `SELECT` `mcp_connections.api_token_encrypted`
- `authenticated` can `SELECT` all three safe metadata views
- `anon` cannot `SELECT` the safe metadata views

The safe views remain `security_invoker=on`, so underlying RLS still applies.

### Workspace isolation

A transaction-scoped two-user/two-workspace test was executed and rolled back. For user A:

- own workspace visible: `1`
- cross-workspace visible: `0`
- own person visible: `1`
- cross-workspace person visible: `0`

`primetime_workspace_memberships` has only an authenticated SELECT policy. There is no INSERT or UPDATE RLS policy, so direct membership self-escalation is denied even though legacy SQL privileges remain granted; governed membership changes remain server-authoritative.

### Security Advisor

After migration, the Supabase Security Advisor reports only 9 `authenticated_security_definer_function_executable` warnings. These are intentionally accepted and documented in `governance/SECURITY_ACCEPTANCE.md`:

- `accept_workspace_invitation(text)`
- `create_workspace(text)`
- `get_cloud_credential_safe(uuid)`
- `get_connection_safe(uuid)`
- `has_valid_connection(text)`
- `list_cloud_credentials()`
- `list_mcp_connections_safe()`
- `list_user_connections()`
- `primetime_workspace_member(uuid)`

All have pinned search paths; `PUBLIC`/`anon` execution is revoked. Credential functions return caller-owned metadata without secret columns; workspace/bootstrap helpers bind to `auth.uid()` and perform tightly scoped operations.

Supabase lint reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Release evidence

- PRIMETIME Staging Certification run #23 passed on the preceding production-hardening PR.
- AI FILMS Production Mastering Canary #15 completed successfully on current `main`, proving the FFmpeg/OpenEXR/JSON mastering repair chain is healthy independently of PRIMETIME database promotion.

## Gate decision

Gate 3 staging security is certified **PASS** subject to repository CI on this migration/evidence PR. Production database promotion remains a separate controlled action after merge and release approval.
