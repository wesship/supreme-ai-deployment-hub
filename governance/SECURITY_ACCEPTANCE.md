# Security Acceptance Log

This document records security findings that are **intentionally accepted**
(not bugs, not deferred fixes). The scanner consults this to avoid
re-flagging known-safe patterns.

## Accepted findings

### Supabase Linter — Authenticated SECURITY DEFINER RPCs (lint 0029)

**Status:** Accepted — 9 SECURITY DEFINER functions remain intentionally callable by `authenticated`.

**Hardening evidence:**
- `20260905022421_gate2r_pin_function_search_paths.sql` pins function search paths.
- `20260905023940_gate2r_security_definer_execute_hardening.sql` revokes `PUBLIC`/`anon` execute and grants only the intended roles.
- `20260906145502_gate3_explicit_service_only_and_credential_column_hardening.sql` removes direct authenticated access to credential secret columns while preserving safe metadata views.
- The 2026-09-06 staging Security Advisor reports only these 9 accepted lint-0029 warnings; the earlier RLS/no-policy findings are resolved.

**Accepted functions and rationale:**
- `accept_workspace_invitation(text)` — requires `auth.uid()`, locks a pending/unexpired hashed-token invitation, verifies the signed-in user's email matches the invitation, then atomically creates/updates membership.
- `create_workspace(text)` — requires `auth.uid()`, validates the workspace name, creates the workspace, owner membership, and audit event atomically.
- `get_cloud_credential_safe(uuid)` — filters by `user_id = auth.uid()` and returns metadata only; encrypted credential bytes are omitted.
- `get_connection_safe(uuid)` — filters by `user_id = auth.uid()` and returns connection metadata only; credential JSON is omitted.
- `has_valid_connection(text)` — returns only a boolean for the signed-in user's own connection state.
- `list_cloud_credentials()` — filters by `user_id = auth.uid()` and returns metadata only; encrypted credential bytes are omitted.
- `list_mcp_connections_safe()` — filters by `user_id = auth.uid()` and omits `api_token_encrypted`.
- `list_user_connections()` — filters by `user_id = auth.uid()` and omits credential JSON.
- `primetime_workspace_member(uuid)` — returns only a boolean tied to `auth.uid()` and active membership; it is the recursion-safe helper used by workspace RLS policies.

**Risk decision:** These functions are intentionally privileged because they either perform a tightly scoped atomic bootstrap/membership operation, strip secret columns server-side, or provide a boolean RLS helper. They are not anonymous APIs. Any body/signature change requires re-review.

### Public read on `agent_templates`

**Status:** Accepted — intentional public marketplace catalog
**Risk evaluation:** Contains only published, non-sensitive template metadata.
No `auth.users` data, no credentials, no PII.

### `deployment-promotion.yml` — risk score 5

**Status:** Accepted — flags are intentional and correctly scoped
**Risk evaluation:**
- `workflow_run` trigger is filtered by `branches: [main]` AND `conclusion == 'success'` — only successful main-branch builds can trigger promotion.
- `id-token: write` is required for OIDC cloud authentication (no static credentials).
- `contents: read` keeps the principle of least privilege; the tag-push step
  uses `github.token` and is tolerant of failure.
- Behavioral risks (silently-swallowed smoke failures, HTTP 000 treated as
  success) were FIXED on 2026-05-22 — see `governance/AUDIT_LOG.md`.

## Re-evaluation triggers

This file must be reviewed when:
- Any listed function's signature or body changes
- New SECURITY DEFINER functions are added
- A new table or column is granted browser-readable access
- Credential storage/view/RPC behavior changes
- After every quarterly security audit
