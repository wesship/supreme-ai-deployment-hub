# PRIMETIME Migration Order Checklist

## Purpose

This checklist defines the database migration order for PRIMETIME Releases 1 through 5 and the validation sequence required before production deployment.

## Migration Order

Apply migrations in timestamp order only.

| Order | Migration | Release | Purpose |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20260718150000_primetime_release1_crm_foundation.sql` | Release 1 | Core CRM/workspace schema |
| 2 | `supabase/migrations/20260718151500_primetime_release1_enforcement.sql` | Release 1 | Enforcement triggers and exceptions |
| 3 | `supabase/migrations/20260718162000_primetime_release2_scheduling.sql` | Release 2 | Scheduling and daily operations |
| 4 | `supabase/migrations/20260718170000_primetime_release3_communications.sql` | Release 3 | Governed communications |
| 5 | `supabase/migrations/20260718173000_primetime_release4_ai_assistance.sql` | Release 4 | AI assistance and action ledger |
| 6 | `supabase/migrations/20260718180000_primetime_release5_analytics_command_center.sql` | Release 5 | Analytics and executive command center |

## Pre-Migration Checklist

- [ ] Confirm target environment.
- [ ] Confirm database owner.
- [ ] Confirm rollback owner.
- [ ] Confirm backup completed.
- [ ] Confirm migration files match reviewed PRs.
- [ ] Confirm production secrets are not used in staging.
- [ ] Confirm no destructive SQL statement is present without explicit approval.

## Staging Migration Steps

1. Snapshot staging database.
2. Apply Release 1 CRM foundation migration.
3. Apply Release 1 enforcement migration.
4. Apply Release 2 scheduling migration.
5. Apply Release 3 communications migration.
6. Apply Release 4 AI assistance migration.
7. Apply Release 5 analytics migration.
8. Validate required tables.
9. Validate required indexes.
10. Validate RLS enabled.
11. Validate seed data.
12. Run static schema tests.
13. Run API static tests.
14. Run seeded E2E tests.

## Production Migration Steps

Production migration may begin only after staging migration and staging application validation pass.

1. Announce deployment window.
2. Confirm owner sign-off.
3. Create production backup.
4. Apply migrations in exact timestamp order.
5. Confirm required tables exist.
6. Confirm RLS enabled.
7. Confirm no unexpected destructive change.
8. Deploy backend.
9. Deploy frontend.
10. Run production smoke tests.

## Required Table Validation

### Release 1

- [ ] `workspaces`
- [ ] `roles`
- [ ] `workspace_memberships`
- [ ] `people`
- [ ] `households`
- [ ] `household_members`
- [ ] `pipeline_stages`
- [ ] `leads`
- [ ] `stage_transitions`
- [ ] `tasks`
- [ ] `activities`
- [ ] `consent_records`
- [ ] `suppression_records`
- [ ] `audit_events`
- [ ] `release_exceptions`

### Release 2

- [ ] `appointments`
- [ ] `appointment_attendees`
- [ ] `availability_rules`
- [ ] `reminders`
- [ ] `no_show_events`
- [ ] `calendar_sync_events`

### Release 3

- [ ] `message_templates`
- [ ] `message_template_versions`
- [ ] `communication_preferences`
- [ ] `communication_frequency_counters`
- [ ] `communications`
- [ ] `communication_events`
- [ ] `communication_policy_checks`

### Release 4

- [ ] `ai_agents`
- [ ] `ai_agent_versions`
- [ ] `ai_assistance_requests`
- [ ] `ai_assistance_outputs`
- [ ] `ai_action_ledger`
- [ ] `ai_approval_requests`
- [ ] `ai_compliance_findings`
- [ ] `ai_knowledge_citations`

### Release 5

- [ ] `analytics_metric_definitions`
- [ ] `executive_dashboards`
- [ ] `dashboard_widgets`
- [ ] `analytics_snapshots`
- [ ] `funnel_stage_snapshots`
- [ ] `agent_performance_snapshots`
- [ ] `compliance_metric_snapshots`
- [ ] `ai_action_metric_snapshots`
- [ ] `release_governance_observations`

## RLS Validation

- [ ] RLS enabled on CRM workspace tables.
- [ ] RLS enabled on scheduling tables.
- [ ] RLS enabled on communications tables.
- [ ] RLS enabled on AI assistance tables.
- [ ] RLS enabled on analytics tables.

## Data Integrity Validation

- [ ] Open leads require owner and next action.
- [ ] Appointment active states require valid time window.
- [ ] Approved templates require approval metadata.
- [ ] AI agent versions require approval metadata for approved status.
- [ ] Analytics snapshots have valid period windows.
- [ ] Conversion rates are between 0 and 1.
- [ ] Scores are between 0 and 100.
- [ ] Counts are non-negative.

## Rollback Notes

Schema rollback must be handled with extreme care. Prefer application rollback first unless a database change creates a confirmed data integrity or availability incident.

Database restore requires:

- Database owner approval.
- Business owner approval.
- Data-loss impact assessment.
- Incident record.
- Redeployment freeze until root cause is documented.
