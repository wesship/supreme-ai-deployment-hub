# PRIMETIME Production Readiness Checklist

## Release Stack Certification

- [x] Release 1: CRM Foundation — certified
- [x] Release 2: Scheduling — certified
- [x] Release 3: Communications — certified
- [x] Release 4: AI Assistance — certified
- [x] Release 5: Analytics — certified
- [ ] Release 6: Production Hardening — in progress
- [ ] Release 7: Advanced Telemetry and Observability — in progress

## Compliance Boundaries

- No autonomous outbound sales calling
- No quote generation endpoint
- No policy recommendation endpoint
- No application submission endpoint
- No DELETE behavior for regulated records
- No communication send endpoint

## Known Blockers

- no_quote_endpoint: enforced across all releases
- no_hard_delete: enforced via trigger and RLS

## Staging Validation

- [x] Release 6 staging gate is automated through the `PRIMETIME Release 6 Staging Gate` workflow.
- The gate uses unauthenticated, read-only GET requests only; it never creates, changes, or deletes regulated records.
- Supply HTTPS frontend and API staging URLs when manually dispatching the workflow. It verifies all certified PRIMETIME frontend routes, `/health`, anonymous API denial, and the absence of blocked endpoint fragments.
- A passing staging gate is required before production deployment, together with compliance signoff and the documented rollback plan.

## Security

- The repository follows the [open-source security baseline](security/OPEN_SOURCE_SECURITY_BASELINE.md); no third-party scanner status context is a release gate.

- All endpoints require Supabase JWT
- Workspace membership enforced
- Role gates on all mutations
- Audit trail on all state changes

## Additional Compliance Boundaries

- No communication without consent check
- No AI execution without audit
- No regulated recommendation without licensed human review
- No hard delete for regulated records
