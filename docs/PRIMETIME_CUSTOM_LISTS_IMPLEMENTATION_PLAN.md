# PRIMETIME Custom Lists — Governed Runtime Implementation Plan

Related: #583, #431, #446, #487, #496

## Decision

Custom Lists will be rebuilt from current `main`. The superseded PR #405 branch will not be rebased or merged.

## Current-runtime boundaries

- Frontend uses the existing authenticated `primetimeRelease1Api` client.
- Backend writes use the governed FastAPI boundary with workspace membership and role checks.
- Browser clients do not receive service-role credentials.
- Tenant-owned tables remain deny-by-default for direct anon/authenticated access.
- Custom Lists integrate with current `/primetime` navigation and workspace selection.
- Audit events use the existing append-only `primetime_audit_events` convention.

## Data model

### `primetime_custom_lists`

- `id uuid primary key`
- `workspace_id uuid not null`
- `display_name text not null`
- `description text not null default ''`
- `archived_at timestamptz null`
- `created_by uuid not null`
- `updated_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `primetime_custom_list_members`

- `id uuid primary key`
- `workspace_id uuid not null`
- `custom_list_id uuid not null`
- `person_id uuid not null`
- `added_by uuid not null`
- `added_at timestamptz not null`
- `removed_by uuid null`
- `removed_at timestamptz null`

Active membership uniqueness is enforced server-side. Record counts are derived from active member rows and are not accepted from clients.

## API surface

- `GET /primetime/v1/custom-lists?workspace_id=...`
- `POST /primetime/v1/custom-lists`
- `PATCH /primetime/v1/custom-lists/{list_id}`
- `POST /primetime/v1/custom-lists/{list_id}/archive`
- `GET /primetime/v1/custom-lists/{list_id}/members`
- `POST /primetime/v1/custom-lists/{list_id}/members`
- `POST /primetime/v1/custom-lists/{list_id}/members/{person_id}/remove`

No hard-delete endpoint will be introduced.

## Roles

Read:

- representative
- trainee
- trainer
- manager
- compliance_reviewer
- workspace_admin
- auditor

Create/update/member changes:

- representative
- manager
- workspace_admin

Archive:

- manager
- workspace_admin

Auditors remain read-only.

## Audit actions

- `crm.custom_list.created`
- `crm.custom_list.updated`
- `crm.custom_list.archived`
- `crm.custom_list.member_added`
- `crm.custom_list.member_removed`

## Delivery sequence

1. Add forward-only Supabase migration.
2. Add governed backend endpoints and tests.
3. Extend the authenticated frontend API client.
4. Add the Custom Lists workspace and navigation entry.
5. Add component and tenant-isolation tests.
6. Capture desktop and mobile screenshots.
7. Run repository, accessibility, security, deployment, and production gates.

## Non-negotiable controls

- No in-memory production source of truth.
- No client-supplied record counts.
- No cross-workspace reads or mutations.
- No hard deletes.
- No direct browser service-role access.
- No duplicate auth, workspace, router, or API-client architecture.
