# PRIMETIME Release 1 Engineering Plan — Governed CRM Foundation

## Release goal

Deliver the minimum governed CRM foundation required for daily insurance operations while enforcing the non-negotiable rules:

- No lead without an owner.
- No open opportunity without a next action.
- No communication without a consent check.
- No AI execution without an audit record.
- No regulated recommendation without a licensed human.

## Implemented in this branch

### Database migration

`supabase/migrations/20260616023000_primetime_release1_crm_foundation.sql`

Creates:

- workspaces
- roles
- workspace_memberships
- people
- households
- household_members
- pipeline_stages
- leads
- stage_transitions
- tasks
- activities
- consent_records
- suppression_records
- audit_events
- release_gate_exceptions

Adds:

- workspace RLS foundation
- membership-based access helper
- immutable audit-event trigger
- indexes for ownership, lead action queues, tasks, consent, suppression, and audits

### Enforcement migration

`supabase/migrations/20260616024500_primetime_release1_enforcement.sql`

Adds:

- updated_at triggers
- required-field enforcement for open leads
- automatic stage-transition history
- automatic lead last-activity updates from activities
- Release 1 exception scanner
- canonical pipeline stage seed function

## Release 1 exit gate

100% of open leads must have:

- owner
- stage
- next action
- next-action deadline
- consent state
- source
- activity record
- last-contact date
- aging indicator

## API implementation backlog

1. Workspace creation and membership routes
2. Role assignment routes
3. People CRUD with deduplication hints
4. Household CRUD and member linking
5. Lead CRUD with stage transitions
6. Task CRUD and completion
7. Activity append-only endpoint
8. Consent and suppression endpoints
9. Audit-event writer
10. Release gate exception list and scanner endpoint

## Frontend implementation backlog

1. Representative daily dashboard shell
2. Lead list with aging and next-action filters
3. Contact workspace
4. Household view
5. Lead creation form with required-field validation
6. Pipeline board
7. Task queue
8. Consent status badge
9. Exception queue
10. Audit trail panel

## Policy checks required before writes

| Operation | Required policy check |
|---|---|
| Create lead | Workspace membership and owner exists |
| Move stage | Required fields for target stage |
| Create activity | Workspace membership and entity access |
| Create task | Workspace membership and assignee exists |
| Create consent record | Valid person and channel |
| Add suppression | Valid reason and channel |
| Export records | Human authorization and audit event |

## Test plan

### Database tests

- Inserting an open lead without owner fails.
- Inserting an open lead without next action fails.
- Inserting an open lead without source fails.
- Updating stage inserts a stage transition.
- Inserting activity updates lead last_activity_at.
- Updating or deleting audit_events fails.
- Workspace RLS blocks non-members.
- Exception scanner detects open leads missing last activity.

### API tests

- Representative can create assigned lead.
- Representative cannot access unrelated workspace records.
- Manager can view team-owned records through policy layer.
- Compliance reviewer can read regulated activity without mutating sales records.
- Suppressed contact blocks communication workflow.

### UI tests

- Lead form blocks missing required fields.
- Daily dashboard lists overdue tasks and leads needing action.
- Exception queue surfaces missing last activity and consent review.
- Pipeline movement requires stage-specific fields.

## Rollback plan

Release 1 migrations are additive. Rollback should:

1. Disable new API routes.
2. Stop frontend links to Release 1 screens.
3. Preserve audit_events, activities, consent_records, suppression_records, and stage_transitions.
4. Do not delete regulated records without legal/compliance approval.

## Named owners

- Product owner: PRIMETIME Supervisor
- Engineering owner: Devonn.AI Platform Engineering
- Compliance owner: Compliance Reviewer role
- Data owner: Workspace Administrator

## Success metric

Release 1 is complete when the system can support a representative's daily lead workflow and every open lead passes the Release 1 exit gate.
