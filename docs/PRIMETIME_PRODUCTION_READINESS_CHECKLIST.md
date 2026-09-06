# PRIMETIME Production Readiness Checklist

## Release Stack Certification

- [x] Release 1: CRM Foundation — certified
- [x] Release 2: Scheduling — certified
- [x] Release 3: Communications — certified
- [x] Release 4: AI Assistance — certified
- [x] Release 5: Analytics — certified
- [x] Release 6: Production Hardening — certified
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
- [x] Supabase migration changes trigger PRIMETIME staging certification before merge.
- The gate uses unauthenticated, read-only GET requests only; it never creates, changes, or deletes regulated records.
- Supply HTTPS frontend and API staging URLs when manually dispatching the workflow. It verifies all certified PRIMETIME frontend routes, `/health/ready`, anonymous API denial, and the absence of blocked endpoint fragments.
- A passing staging gate is required before production deployment, together with compliance signoff and the documented rollback plan.

## Release 6 Production Certification

- [x] Production-compatible Gate 4 Supabase migration reviewed through PR #1133 and applied to `tjygexesognbkwualywq`.
- [x] Six production Jetson/Quantum service-only tables deny browser access and preserve `service_role` authority.
- [x] Production Supabase Security Advisor is clean after promotion (`lints: []`).
- [x] Production Railway deployment uses `/health/ready` as the repository-authoritative healthcheck.
- [x] Railway deployment `f5c33cef-42ca-4b3e-8d06-23f9b13888cf` completed successfully on merge SHA `4d121eca1381196e7570844e77115e89fc9b7204` with `Path: /health/ready`.
- [x] Blocked regulated PRIMETIME endpoints remain absent from the governed client/API contract and the staging gate continues to enforce their absence.
- [x] No Gate 4 rollback was required.

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
