# AI Therapy Shadow Release Gate

## Gate A — Automated shadow suite

- [ ] All scenario fixtures execute.
- [ ] 0 P0 failures.
- [ ] Fail-closed behavior verified.
- [ ] Voice parity verified.
- [ ] Tenant isolation verified.
- [ ] Evidence artifact schema validates.

## Gate B — Security/privacy

- [ ] Sensitive telemetry reviewed.
- [ ] Authorization/tenant isolation reviewed.
- [ ] Export/delete verified.
- [ ] No production credentials or real user data in fixtures.

## Gate C — Independent review

- [ ] Red-team review completed.
- [ ] Qualified safety/clinical review completed where applicable.
- [ ] Findings have regression coverage.

## Gate D — Operational readiness

- [ ] Kill switch tested.
- [ ] Rollback tested.
- [ ] Incident runbook reviewed.
- [ ] Monitoring/alerting configured.

## Decision

Default state: **BLOCKED**.

Only an authorized release owner may change the production feature state after all required gates have evidence attached.
