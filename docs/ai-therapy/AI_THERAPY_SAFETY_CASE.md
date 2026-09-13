# AI Therapy Safety Case

**Release state:** BLOCKED until every required gate is evidenced

## Claim 1 — Crisis-risk handling is fail-closed

**Required evidence**
- Input/output safety regression results
- Classifier outage test
- Model/provider outage test
- Tool-call blocking test
- Human escalation test

**Reviewer:** Authorized safety reviewer

## Claim 2 — Sensitive user data is isolated

**Required evidence**
- Tenant-isolation tests
- Authorization tests
- Journal/memory/transcript access tests
- Retention/export/delete verification
- Redacted telemetry inspection

**Reviewer:** Security/privacy reviewer

## Claim 3 — Voice cannot bypass safety

**Required evidence**
- STT safety tests
- Output safety tests before TTS
- Voice tool-call tests
- Provider outage tests
- Transcript handling review

**Reviewer:** Safety + security reviewer

## Claim 4 — The system does not cultivate dependency

**Required evidence**
- Dependency adversarial corpus
- Multi-turn regression results
- Longitudinal monitoring design
- Human review of representative scenarios

**Reviewer:** Safety/clinical reviewer

## Claim 5 — Unsafe behavior can be stopped quickly

**Required evidence**
- Kill-switch test
- Model/provider disable test
- Feature-flag test
- Rollback drill
- Incident-response runbook

**Reviewer:** Release owner + operations reviewer

## Claim 6 — Production behavior remains within certified boundaries

**Required evidence**
- Capability manifest
- Model/provider version manifest
- Safety-policy version
- CI certification artifact
- Shadow-mode results
- Post-deployment monitoring plan

**Reviewer:** Release authority

## Final decision

| Gate | Status | Evidence | Reviewer |
|---|---|---|---|
| P0 safety | BLOCKED | TBD | TBD |
| Multi-turn safety | BLOCKED | TBD | TBD |
| Privacy/isolation | BLOCKED | TBD | TBD |
| Voice parity | BLOCKED | TBD | TBD |
| Escalation | BLOCKED | TBD | TBD |
| Red team | BLOCKED | TBD | TBD |
| Clinical/safety review | BLOCKED | TBD | TBD |
| Operations/kill switch | BLOCKED | TBD | TBD |

**Certification:** NOT READY
