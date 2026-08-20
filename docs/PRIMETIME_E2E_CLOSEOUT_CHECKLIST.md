# PRIMETIME End-to-End Closeout Checklist

## Runtime
- [ ] Authenticated organization context is resolved from the principal.
- [ ] HMAC signature and replay protection pass.
- [ ] PostgreSQL idempotency is authoritative.
- [ ] Redis lock is advisory/fast-path only.
- [ ] Persistence and queue intent are atomic.
- [ ] Durable queue recovery is verified.
- [ ] Event fabric correlation is present for every transition.

## Governance
- [ ] Workflow transitions are deny-by-default.
- [ ] Agents cannot approve their own work.
- [ ] Outbound side effects require human approval and policy checks.
- [ ] Agent capabilities are deny-by-default.
- [ ] AI provenance records model, version, agent, and policy/template versions.

## Data
- [ ] Existing CRM remains canonical lead source.
- [ ] Existing knowledge_embeddings remains canonical vector store until model/dimension is confirmed.
- [ ] RLS isolation passes cross-organization negative tests.
- [ ] Foreign keys and tenant predicates are indexed.
- [ ] No production migration is run until staging rehearsal passes.

## Failure injection
- [ ] Duplicate delivery.
- [ ] Concurrent delivery.
- [ ] Redis unavailable.
- [ ] Database transaction rollback.
- [ ] Queue unavailable after persistence.
- [ ] Worker crash before acknowledgement.
- [ ] Worker crash after acknowledgement.
- [ ] Provider/model timeout.
- [ ] Agent capability escalation attempt.
- [ ] Unauthorized approval attempt.

## Release gates
- [ ] Backend unit/integration suite passes.
- [ ] Frontend static/E2E suite passes.
- [ ] Supabase security advisor has no new PRIMETIME findings.
- [ ] Performance advisor has no new blocking PRIMETIME findings.
- [ ] GitHub required checks pass.
- [ ] Snyk security gate passes without bypass.
- [ ] Vercel preview deployment is READY.
- [ ] Browser verification passes.
- [ ] Production deployment remains blocked until all gates are green.
