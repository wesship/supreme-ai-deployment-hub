# PRIMETIME Release 1 — Next Engineering Gate

## Gate name

Release 1 API and UI Foundation

## Goal

Turn the Release 1 database schema into a usable governed CRM workflow.

## Build order

1. Create `/api/primetime/v1` FastAPI router.
2. Add workspace and role policy dependency.
3. Add people and household endpoints.
4. Add lead creation and pipeline movement endpoints.
5. Add task and activity endpoints.
6. Add consent and suppression endpoints.
7. Add release-gate exception endpoints.
8. Add audit-event writer middleware/helper.
9. Build representative daily dashboard.
10. Build lead list, pipeline board, and exception queue.

## Required engineering rules

- Every mutating endpoint requires `X-Workspace-Id`.
- Every mutating endpoint returns an audit reference.
- Every lead write must preserve the owner and next-action rules.
- Every communication-related check must read consent and suppression state.
- Every sensitive access must produce an audit event.

## Exit criteria

- A representative can create a person, household, lead, task, and activity.
- Pipeline stage transitions are recorded.
- Lead last activity is updated by activity insertion.
- Leads missing release-gate requirements appear in the exception queue.
- RLS blocks access outside workspace membership.
- Static and integration tests pass.
