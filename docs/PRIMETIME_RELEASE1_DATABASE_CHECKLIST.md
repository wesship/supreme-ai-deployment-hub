# PRIMETIME Release 1 Database Checklist

## Migration files

- [ ] `20260616023000_primetime_release1_crm_foundation.sql`
- [ ] `20260616024500_primetime_release1_enforcement.sql`

## Required tables

- [ ] workspaces
- [ ] roles
- [ ] workspace_memberships
- [ ] people
- [ ] households
- [ ] household_members
- [ ] pipeline_stages
- [ ] leads
- [ ] stage_transitions
- [ ] tasks
- [ ] activities
- [ ] consent_records
- [ ] suppression_records
- [ ] audit_events
- [ ] release_gate_exceptions

## Required enforcement

- [ ] RLS enabled on all Release 1 tables
- [ ] Workspace membership helper exists
- [ ] Open lead owner enforcement exists
- [ ] Open lead next-action enforcement exists
- [ ] Open lead source enforcement exists
- [ ] Stage transition trigger exists
- [ ] Activity-to-lead last-activity trigger exists
- [ ] Audit events are immutable
- [ ] Canonical pipeline seed function exists
- [ ] Release 1 exception scanner exists

## Required staging tests

- [ ] Non-member cannot read workspace records
- [ ] Open lead without owner fails
- [ ] Open lead without next action fails
- [ ] Open lead without source fails
- [ ] Lead stage update creates transition row
- [ ] Activity insert updates lead last activity
- [ ] Audit update fails
- [ ] Audit delete fails
- [ ] Consent review exception is created for unknown consent
- [ ] Suppressed contact blocks communication workflow

## Go/no-go

Do not ship Release 1 until all checks pass in a staging Supabase database and the application API logs every sensitive write to `audit_events`.
