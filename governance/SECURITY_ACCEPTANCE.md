# Security Acceptance Log

This document records security findings that are **intentionally accepted**
(not bugs, not deferred fixes). The scanner consults this to avoid
re-flagging known-safe patterns.

## Accepted findings

### Supabase Linter — Function Search Path / Public Execute (lint 0029)

**Status:** Accepted — 9 SECURITY DEFINER functions remain callable by `authenticated`
**Migration that hardened:** `20260522134809_*.sql` (revoked `anon` EXECUTE on all 15 fns)
**Risk evaluation:** Each accepted function gates internally on `auth.uid()`,
returns only the caller's own rows, and must remain `SECURITY DEFINER` so
encrypted-column stripping happens server-side.

Accepted functions (called from app):
- `claim_first_admin`
- `list_user_connections`
- `get_connection_safe`
- `list_cloud_credentials`
- `get_cloud_credential_safe`
- `list_mcp_connections_safe`
- `has_valid_connection`
- `log_api_usage`
- `is_admin`

Trigger/internal-only (no API exposure, anon revoked):
- `update_workflow_timestamp`
- `update_updated_at_column`
- `encrypt_credentials`
- `decrypt_credentials`
- `update_persona_timestamp`
- `update_conversation_timestamp`

### Public read on `agent_templates`

**Status:** Accepted — intentional public marketplace catalog
**Risk evaluation:** Contains only published, non-sensitive template metadata.
No `auth.users` data, no credentials, no PII.

## Re-evaluation triggers

This file must be reviewed when:
- Any listed function's signature or body changes
- New SECURITY DEFINER functions are added
- A new table is granted public SELECT
- After every quarterly security audit
