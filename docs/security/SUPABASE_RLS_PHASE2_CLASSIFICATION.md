# Supabase RLS Phase 2 Classification

Related issue: #504

## Purpose

This document classifies the Phase 2 P0 tables before RLS changes are promoted. It is intentionally conservative: where the application routes access through the trusted FastAPI service-role boundary, direct browser access remains denied.

## Evidence and authorization boundary

The governed Primetime AI Assistance router:

- authenticates the user through `get_current_user_id`
- uses `SUPABASE_SERVICE_ROLE_KEY` for database requests
- validates workspace membership through `primetime_workspace_memberships`
- resolves the member role through `primetime_roles`
- enforces operation-specific role sets before database mutation

This means RLS cannot replace the API authorization logic yet. Until a browser-direct use case is intentionally designed and tested, the governed workspace tables remain backend-only.

## Caller trace and schema-drift conclusion

Repository, production-schema, and isolated-branch tracing found:

- The active human-approval path uses `approval_queue`, not `approval_requests`.
- The active OCC/RAG metadata path uses `rag_documents`, not `rag_document_logs`.
- `approval_requests` and `rag_document_logs` have no identified application callers and contained zero production rows during review.
- `approval_requests`, `rag_document_logs`, `approval_queue`, and `rag_documents` exist in production but are absent from fresh Supabase branches, demonstrating production schema drift outside the repository migration chain.

Because the two legacy target tables cannot be reproduced and validated from repository migrations, Phase 2A does **not** alter them. They are deferred to a separate drift-remediation phase that must first capture their production schemas in append-only repository migrations.

## Access classes

- **Backend-only**: no `PUBLIC`, `anon`, or `authenticated` table privileges; trusted `service_role` only.
- **Workspace-scoped — deferred**: structurally supports workspace policies, but direct browser access is not approved until membership helpers and cross-workspace tests are implemented.
- **Reference — backend-only**: global reference data read through the governed API, not directly from browsers.
- **Production-drift deferred**: production-only table excluded from promotion until its schema is reproducible and staging-tested.

## P0 classification matrix

| Table | Ownership columns | Current callers / boundary | Classification | Expected browser behavior | Required validation |
|---|---|---|---|---|---|
| `ai_action_ledger` | `workspace_id`, `proposed_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Verify action proposal, approval, execution, and audit flows through API |
| `ai_approval_requests` | `workspace_id`, `requested_by`, `decided_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test reviewer roles and cross-workspace denial at API boundary |
| `ai_assistance_requests` | `workspace_id`, `requested_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test representative create/read and cross-workspace denial |
| `ai_assistance_outputs` | `workspace_id`, `created_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test draft/review transitions and reviewer restrictions |
| `ai_compliance_findings` | `workspace_id`, `created_by`, `resolved_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test compliance reviewer and manager permissions |
| `ai_agents` | `workspace_id`, `created_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test admin-only create/update and read-role matrix |
| `ai_agent_versions` | `workspace_id`, `created_by`, `approved_by` | Governed FastAPI AI router via service role | Backend-only; workspace-scoped deferred | No direct read/write | Test version approval and immutable history expectations |
| `approval_requests` | `user_id` | No active caller; active feature uses `approval_queue` | Production-drift deferred | Existing production posture unchanged by Phase 2A | Capture schema in migrations, recreate on branch, then validate hardening |
| `rag_document_logs` | `user_id` | No active caller; active feature uses `rag_documents` | Production-drift deferred | Existing production posture unchanged by Phase 2A | Capture schema in migrations, recreate on branch, then validate hardening |
| `primetime_workspaces` | `created_by` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Define workspace discovery/bootstrap flow before browser policy |
| `primetime_workspace_memberships` | `workspace_id`, `user_id` | Authorization source for governed API | Backend-only authorization table | No direct browser mutation or read | Prevent self-escalation; test membership lookup and admin changes |
| `primetime_roles` | global reference table | Role lookup by governed API | Reference — backend-only | No direct browser read/write | Confirm role seeding and role-code stability |
| `primetime_people` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test member roles, ownership rules, and PII exposure boundaries |
| `primetime_households` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test household access through workspace membership |
| `primetime_household_members` | `workspace_id` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test linked person/household workspace consistency |
| `primetime_leads` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime CRM API | Backend-only; workspace-scoped deferred | No direct read/write | Test assignment roles, consent state, and cross-workspace denial |
| `primetime_tasks` | `workspace_id`, `owner_id`, `created_by` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Test assignee/manager visibility and mutation rules |
| `primetime_activities` | `workspace_id`, `actor_id` | Governed Primetime API | Backend-only; workspace-scoped deferred | No direct read/write | Test append-only/audit expectations and workspace filtering |
| `primetime_ai_actions` | `workspace_id`, `initiated_by`, reviewer IDs | Governed Primetime AI API | Backend-only; workspace-scoped deferred | No direct read/write | Test approval-required actions and blocked autonomous actions |
| `primetime_ai_agents` | `workspace_id`, `created_by` | Governed Primetime AI API | Backend-only; workspace-scoped deferred | No direct read/write | Test admin configuration and non-admin read rules through API |
| `primetime_audit_events` | `workspace_id`, `actor_id` | Governed APIs and service-role audit writes | Backend-only; append-only | No direct read/write | Test audit immutability and auditor access through API |
| `primetime_consent_records` | `workspace_id`, `person_id`, `recorded_by` | Governed communications/compliance API | Backend-only; workspace-scoped deferred | No direct read/write | Test consent evidence access and mutation restrictions |
| `primetime_suppression_records` | `workspace_id`, `person_id`, `created_by` | Governed communications/compliance API | Backend-only; workspace-scoped deferred | No direct read/write | Test suppression enforcement before all outbound actions |
| `primetime_release_exceptions` | `workspace_id` | Release governance / admin operations | Backend-only; admin-only read deferred | No direct read/write | Test platform/workspace admin visibility and resolution flow |

## Phase 2A migration boundary

Phase 2A covers the 22 P0 tables reproduced by repository migrations:

1. Enable RLS on every existing target table.
2. Revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`.
3. Grant required table privileges to `service_role`.
4. Create an explicit false-valued browser deny policy on each target table.
5. Do not introduce workspace browser policies.
6. Do not alter production-only drift tables.
7. Preserve append-only migration governance and validate on an isolated Supabase branch.

## Required test matrix

- Anonymous: permission denied on every Phase 2A table.
- Ordinary authenticated user: permission denied on every Phase 2A table.
- Workspace member: succeeds only through the governed API for their workspace.
- Cross-workspace member: denied by the API authorization boundary.
- Workspace admin/compliance roles: only approved API operations succeed.
- `service_role`: required reads, inserts, updates, and deletes continue to work.
- Production-drift tables: unchanged by Phase 2A.
- Active `approval_queue` and `rag_documents`: excluded from Phase 2A.

## Explicit non-goals

- No direct browser access expansion.
- No replacement of FastAPI role enforcement with incomplete RLS.
- No public-read policies for P0 data.
- No modification of production-only legacy drift tables.
- No production application of Phase 2A without isolated-branch validation and separate approval.
