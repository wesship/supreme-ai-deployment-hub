# PRIMETIME Release Stack Runbook

## Merge Order

The following PRs must be merged in order:

1. #434 — Release 1: CRM Foundation
2. #435 — Release 2: Scheduling
3. #436 — Release 3: Communications
4. #437 — Release 4: AI Assistance
5. #440 — Release 5: Analytics
6. #441 — Release 6: Production Hardening (schema)
7. #442 — Release 6: Production Hardening (frontend routes)

## Rollback Rules

- Rollback must preserve regulated records
- Do not delete regulated records under any circumstance
- Do not truncate production audit tables
- Forward-only migrations — no destructive rollbacks

## Emergency Procedures

If a rollback is required:
1. Disable the affected release router in backend/main.py
2. Do NOT drop tables or delete data
3. Notify compliance team
4. Document the incident in the audit trail
