# PRIMETIME Release 5 — Analytics and Executive Command Center Plan

## Purpose

Release 5 turns PRIMETIME from a governed operating system into a measurable executive command center. It adds production dashboards, funnel metrics, agent performance snapshots, compliance metrics, AI action metrics, and release-governance observability.

## Scope

Release 5 includes:

- Analytics metric definitions
- Executive dashboards
- Dashboard widgets
- Analytics snapshots
- Funnel stage snapshots
- Agent performance snapshots
- Compliance metric snapshots
- AI action metric snapshots
- Release governance observations
- Runtime API surface
- Executive command center UI
- Seeded E2E coverage

## Business objectives

- Give managers a daily view of lead flow, task completion, appointments, no-shows, communication posture, and AI-assisted work.
- Give compliance reviewers measurable visibility into blocked communications, blocked AI actions, unresolved findings, pending approvals, and audit volume.
- Give workspace administrators release-readiness visibility across schema, API, UI, E2E, governance controls, and known risks.
- Keep analytics read-only for business records. Release 5 observes and records snapshots; it does not mutate leads, people, policies, communications, or AI actions.

## Command center surfaces

1. Executive overview
   - Open leads
   - Open tasks
   - Appointment count
   - No-show count
   - Pending approvals
   - Compliance score
   - Blocked AI actions

2. Funnel intelligence
   - Stage counts
   - Entered/exited counts
   - Conversion rate
   - Median age in stage

3. Agent performance
   - Assigned leads
   - Completed tasks
   - Open tasks
   - Appointments
   - No-shows
   - Draft communications
   - AI assistance requests
   - Score

4. Compliance intelligence
   - Open exceptions
   - Blocked communications
   - Blocked AI actions
   - Pending approvals
   - Unresolved findings
   - Audit event volume

5. AI action intelligence
   - Proposed actions
   - Approval-required actions
   - Approved actions
   - Blocked actions
   - Rejected actions
   - Executed actions
   - High-risk actions
   - Estimated automation savings

6. Release governance
   - Exit gates
   - Risks
   - Metric gaps
   - Test gaps
   - Policy gaps
   - Incidents
   - Improvements

## Governance boundaries

Release 5 must not introduce:

- DELETE endpoints
- Business-record mutation from analytics endpoints
- Autonomous AI execution
- Product recommendations
- Quote generation
- Application submission
- Communication sending
- Bypassing workspace membership
- Bypassing compliance roles

## Roles

- Representative: read assigned/allowed dashboards and personal performance metrics.
- Manager: read team metrics, funnel metrics, agent performance, and operational snapshots.
- Compliance reviewer: read compliance dashboards, policy gaps, blocked actions, and audit-heavy metrics.
- Workspace admin: configure dashboards, widgets, metric definitions, and release governance observations.
- Auditor: read analytics and governance history.

## Definition of done

- Migration added
- Static schema tests added
- Runtime API added
- Frontend API methods added
- Executive command center UI added
- Static UI tests added
- Seeded E2E added
- PR is mergeable
- No autonomous regulated behavior introduced
