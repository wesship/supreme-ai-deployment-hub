# PRIMETIME Governed Custom Lists

## Purpose

Custom Lists provide workspace-scoped contact grouping inside PRIMETIME without introducing a browser-to-database write path. The feature reuses the existing Release 1 authentication, workspace membership, role, people, and audit contracts.

## Security boundary

- Browser code authenticates with the user's Supabase access token and calls the FastAPI backend only.
- The browser never receives or uses the Supabase service-role credential.
- Direct `anon` and `authenticated` table access to custom-list tables is revoked.
- The FastAPI service validates workspace membership and role before mutations.
- PostgreSQL repeats the workspace-role check inside service-role-only `SECURITY DEFINER` RPCs.
- Every mutation and its immutable `primetime_audit_events` record occur in the same database transaction. If audit insertion fails, the mutation rolls back.
- No hard-delete API exists. Lists are archived and memberships are soft-removed.

## Roles

| Operation | Allowed roles |
| --- | --- |
| Read lists and members | Any active workspace member |
| Create/update list | `representative`, `manager`, `workspace_admin` |
| Add/remove member | `representative`, `manager`, `workspace_admin` |
| Archive list | `manager`, `workspace_admin` |

The UI hides or disables controls for known insufficient roles, but backend and SQL authorization remain authoritative.

## API contract

- `GET /primetime/v1/custom-lists?workspace_id=...`
- `POST /primetime/v1/custom-lists`
- `PATCH /primetime/v1/custom-lists/{list_id}`
- `POST /primetime/v1/custom-lists/{list_id}/archive`
- `GET /primetime/v1/custom-lists/{list_id}/members?workspace_id=...`
- `POST /primetime/v1/custom-lists/{list_id}/members`
- `POST /primetime/v1/custom-lists/{list_id}/members/{person_id}/remove`

`record_count` is derived from active membership records; clients cannot submit or override it.

## Atomic mutation RPCs

- `primetime_create_custom_list`
- `primetime_update_custom_list`
- `primetime_archive_custom_list`
- `primetime_add_custom_list_member`
- `primetime_remove_custom_list_member`

Execute permission is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.

## Tenant isolation acceptance

A release is not approved until automated tests and staging acceptance confirm all of the following:

1. A non-member cannot read or mutate another workspace's lists.
2. A valid member cannot address a list or person from another workspace through a list mutation.
3. A representative cannot archive a list.
4. Archived lists cannot receive membership changes.
5. Duplicate active list names and duplicate active memberships return conflict responses.
6. A failed audit insert rolls back the business mutation.
7. Browser bundles contain no service-role credential or direct custom-list table write path.

## Rollout status during GitHub billing lock

The implementation is intentionally kept in a draft pull request while GitHub Actions is unavailable. No merge, migration apply, or production deployment is authorized until the exact head passes the repository's normal migration, CodeQL, Gitleaks, dependency/container, hardened build, accessibility, testing, signing, trusted-runner, and required PR gates.
