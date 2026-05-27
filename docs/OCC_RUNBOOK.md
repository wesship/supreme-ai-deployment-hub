# Devonn.ai Operator Command Center Runbook

_Last updated: 2026-05-27_

## Purpose

The Operator Command Center (OCC) is the admin-grade control layer for Devonn.ai. It provides a protected dashboard and backend API for monitoring AI usage, agent activity, tool calls, RAG documents, approvals, error logs, and user plan controls.

This document explains how to verify, operate, and safely troubleshoot the OCC after PR #202.

## Current production status

| Area | Status |
|---|---|
| PR #202 | Merged into `main` |
| Merge commit | `af858feed4989e2763ccdafe02a05e8aa742e05e` |
| Admin UI route | `/admin` |
| Backend admin API prefix | `/api/admin/*` when mounted through the API router |
| Required role | Supabase user `app_metadata.role = admin` |
| Dev-only bypass | `ALLOW_DEV_ADMIN_BYPASS=true` only for local development |
| Production bypass | Must remain disabled |

## OCC capabilities

The OCC provides these operator functions:

1. Overview metrics
2. AI request and cost tracking
3. Tool call logs
4. Agent activity logs
5. RAG document management
6. Approval queue review
7. Error monitoring and resolution
8. User plan management

## Backend endpoints

The admin router is mounted with the internal prefix `/admin`; when included under the API router, production endpoints resolve under `/api/admin`.

| Endpoint | Method | Purpose |
|---|---:|---|
| `/api/admin/overview` | GET | High-level dashboard metrics |
| `/api/admin/ai-logs` | GET | Recent AI request logs |
| `/api/admin/ai-costs` | GET | AI cost aggregation by model |
| `/api/admin/tool-logs` | GET | Tool execution log stream |
| `/api/admin/agent-logs` | GET | Agent activity stream |
| `/api/admin/rag-documents` | GET | RAG document list |
| `/api/admin/rag-documents/{doc_id}` | DELETE | Soft-delete a RAG document |
| `/api/admin/approvals` | GET | Approval queue items |
| `/api/admin/approvals/{approval_id}` | PATCH | Approve or reject an item |
| `/api/admin/errors` | GET | Error log stream |
| `/api/admin/errors/{error_id}/resolve` | PATCH | Mark error resolved |
| `/api/admin/plans` | GET | User plan list |
| `/api/admin/plans/{user_id}` | PATCH | Update user plan limits |

## Required environment variables

Production must provide:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side-service-role-key>
```

Optional local-only variable:

```bash
ALLOW_DEV_ADMIN_BYPASS=false
```

Never set `ALLOW_DEV_ADMIN_BYPASS=true` in production.

## Security model

The OCC admin backend is protected by these controls:

- Supabase JWT user identity is required.
- Admin access requires `app_metadata.role = admin`.
- Supabase outbound host is allow-listed to `https://*.supabase.co` and `https://*.supabase.in`.
- Supabase REST table access is restricted to a fixed allow-list.
- Query strings are passed through `httpx params={}` instead of unsafe URL interpolation.
- Path parameters that enter privileged operations are UUID validated.
- Missing Supabase configuration returns `503` unless an explicit local dev bypass is enabled.

## Post-deploy smoke tests

Run these after every production deployment.

### 1. Confirm frontend is reachable

```bash
curl -I https://devonn.ai
```

Expected: `200`, `301`, or `308` depending on hosting redirect behavior.

### 2. Confirm public admin API does not leak data

```bash
curl -i https://devonn.ai/api/admin/overview
```

Expected: `401`, `403`, or `503`.

Do not accept a response containing real admin metrics without authentication.

### 3. Confirm non-admin users are denied

```bash
curl -i \
  -H "Authorization: Bearer <non-admin-user-jwt>" \
  https://devonn.ai/api/admin/overview
```

Expected: `403 Admin access required`.

### 4. Confirm admin users can access OCC

```bash
curl -i \
  -H "Authorization: Bearer <admin-user-jwt>" \
  https://devonn.ai/api/admin/overview
```

Expected: `200` with dashboard summary fields.

## Supabase admin role setup

For the user who should access the OCC, set:

```json
{
  "role": "admin"
}
```

inside Supabase Auth user `app_metadata`.

Recommended: use a dedicated admin account rather than a normal daily-use user.

## Required database tables

The dashboard expects these Supabase tables or compatible views:

- `ai_request_logs`
- `tool_call_logs`
- `agent_activity_logs`
- `error_logs`
- `approval_queue`
- `user_plans`
- `rag_documents`

If the dashboard loads but shows empty panels, confirm the tables exist, the service role key is valid, and the backend can query them.

## Local verification commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Useful repo diagnostics:

```bash
pnpm ci:doctor
pnpm workflow:audit
pnpm pins:validate
pnpm repo:entropy
```

## Operational watchlist

Monitor these after each OCC release:

- Admin endpoint returns only authenticated/admin data.
- AI cost totals match provider billing.
- Approval queue does not accumulate stale requests.
- Error logs show useful stack or context metadata.
- RAG document deletion remains soft-delete, not destructive delete.
- Service role key is never exposed client-side.
- Branch protection remains enabled after emergency bypasses.

## Rollback plan

If OCC causes production instability:

1. Revert the offending commit or PR from `main`.
2. Redeploy production frontend/backend.
3. Confirm `/admin` is inaccessible or stable.
4. Confirm `/api/admin/overview` does not leak data.
5. Open a follow-up PR with tests reproducing the failure.

## Recommended next improvements

1. Add an automated `/api/admin/overview` smoke test that verifies unauthenticated access is denied.
2. Add a Supabase migration file for all OCC tables.
3. Add seed/mock data for local dashboard development.
4. Add an admin onboarding guide for creating the first Supabase admin user.
5. Add screenshots of the OCC dashboard to the README.
