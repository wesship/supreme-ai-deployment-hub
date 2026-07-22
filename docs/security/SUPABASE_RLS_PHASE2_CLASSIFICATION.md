# Supabase RLS Phase 2 Classification

Related issue: #504

## Purpose

This document classifies the Phase 2 P0 tables before any RLS migration is written. It is intentionally conservative: where the application already routes access through the trusted FastAPI service-role boundary, direct browser access remains denied.

## Evidence and authorization boundary

The governed Primetime AI Assistance router:

- authenticates the user through `get_current_user_id`
- uses `SUPABASE_SERVICE_ROLE_KEY` for database requests
- validates workspace membership through `primetime_workspace_memberships`
- resolves the member role through `primetime_roles`
- enforces operation-specific role sets before database mutation

This means RLS cannot replace the API authorization logic yet. Until a browser-direct use case is intentionally designed and tested, the governed workspace tables should remain backend-only.

## Access classes

- **Backend-only**: no `anon` or `authenticated` table privileges or policies; trusted `service_role` only.
- **User-scoped**: authenticated access restricted to `user_id = auth.uid()`; no cross-user access.
- **Workspace-scoped — deferred**: structurally supports workspace policies, but direct browser access is not approved until membership helpers and cross-workspace tests are implemented.
- **Reference — backend-only**: global reference data read through the governed API, not directly from browsers.

## P0 classification matrix

| Table | Ownership columns | Current callers / boundary | Classification | Expected browser behavior | Required validation before policy SQL |
|---|---|---|---|---|---|
| `ai_action_ledger` | `workspace_id`, `proposed_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Verify action proposal, approval, execution, and audit flows through API |
| `ai_approval_requests` | `workspace_id`, `requested_by`, `decided_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test reviewer roles and cross-workspace denial at API boundary |
| `ai_assistance_requests` | `workspace_id`, `requested_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test representative create/read and cross-workspace denial |
| `ai_assistance_outputs` | `workspace_id`, `created_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test draft/review transitions and reviewer restrictions |
| `ai_compliance_findings` | `workspace_id`, `created_by`, `resolved_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test compliance reviewer and manager permissions |
| `ai_agents` | `workspace_id`, `created_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test admin-only create/update and read-role matrix |
| `ai_agent_versions` | `workspace_id`, `created_by`, `approved_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test version approval and immutable history expectations |
| `approval_requests` | `user_id` | Standalone user approval domain; no workspace column | User-scoped | User can access own rows only | Trace all frontend/backend callers and test owner/cross-user behavior |
| `rag_document_logs` | `user_id` | Per-user document ingestion/logging domain | User-scoped read; trusted backend write | User reads own logs; browser writes denied unless explicitly required | Trace upload pipeline and verify service-role writes |
| `primetime_workspaces` | `created_by` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Define workspace discovery/bootstrap flow before browser policy |
| `primetime_workspace_memberships` | `workspace_id`, `user_id` | Authorization source for governed API | Backend-only authorization table | No direct browser mutation; reads remain through API | Prevent self-escalation; test membership lookup and admin changes |
| `primetime_roles` | global reference table | Role lookup by governed API | Reference — backend-only | No direct browser mutation or read requirement | Confirm role seeding and role-code stability |
| `primetime_people` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test member roles, ownership rules, and PII exposure boundaries |
| `primetime_households` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test household access through workspace membership |
| `primetime_household_members` | `workspace_id` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test linked person/household workspace consistency |
| `primetime_leads` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test assignment roles, consent state, and cross-workspace denial |
| `primetime_tasks` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Test assignee/manager visibility and mutation rules |
| `primetime_activities` | `workspace_id`, `actor_id` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Test append-only/audit expectations and workspace filtering |
| `primetime_ai_actions` | `workspace_id`, `initiated_by`, reviewer IDs | Governed Primetime AI API | Backend-only; workspace-scoped deferred | No direct read/write | Test approval-required actions and blocked autonomous actions |
| `primetime_ai_agents` | `workspace_id`, `created_by` | Governed Primetime AI API | Backend-only; workspace-scoped deferred | No direct read/write | Test admin configuration and non-admin read rules through API |
| `primetime_audit_events` | `workspace_id`, `actor_id` | Governed APIs and service-role audit writes | Backend-only; append-only | No direct write; admin/auditor reads through API only | Test audit immutability and auditor access |
| `primetime_consent_records` | `workspace_id`, `person_id`, `recorded_by` | Governed communications/compliance API | Backend-only; workspace-scoped deferred | No direct read/write | Test consent evidence access and mutation restrictions |
| `primetime_suppression_records` | `workspace_id`, `person_id`, `created_by` | Governed communications/compliance API | Backend-only; workspace-scoped deferred | No direct read/write | Test suppression enforcement before all outbound actions |
| `primetime_release_exceptions` | `workspace_id` | Release governance / admin operations | Backend-only; admin-only read deferred | No direct read/write | Test platform/workspace admin visibility and resolution flow |

## Phase 2A migration boundary

The first Phase 2 migration should only enforce the conservative baseline:

1. Revoke all privileges from `anon` and `authenticated` on P0 backend-only tables.
2. Grant required privileges to `service_role`.
3. Add owner-scoped policies only for `approval_requests` and `rag_document_logs` after caller tracing is complete.
4. Do not introduce workspace browser policies until a reusable membership authorization helper is reviewed for recursion, privilege escalation, and query performance.
5. Preserve append-only migration governance and validate on a new isolated Supabase branch.

## Required test matrix

- Anonymous: denied on every P0 table.
- Ordinary authenticated user: denied on backend-only tables.
- User A: can access only User A rows on approved user-scoped tables.
- User B: cannot access User A rows.
- Workspace member: succeeds through governed API for their workspace.
- Cross-workspace member: denied by the API authorization boundary.
- Workspace admin/compliance roles: only approved operations succeed.
- `service_role`: required reads/writes continue to work.

## Explicit non-goals

- No production SQL in this classification change.
- No direct browser access expansion.
- No replacement of FastAPI role enforcement with incomplete RLS.
- No public-read policies for P0 data.
