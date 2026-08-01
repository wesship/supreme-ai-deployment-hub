# D3VONN.IO Day-One Monitoring and Incident Checklist

## Purpose

Use this checklist during the first 24–48 hours after the v1.0.0 production release. It is designed to detect user-facing regressions quickly without changing production configuration during routine observation.

## Observation cadence

- First 2 hours: check every 15–30 minutes
- Hours 2–8: check hourly
- Hours 8–24: check every 2–4 hours
- Day 2: check morning, midday, and evening

## Critical service checks

### Public website and Vercel

- `https://d3vonn.io` returns a successful production page
- `https://www.d3vonn.io` serves or redirects correctly
- `https://app.d3vonn.io` resolves to the intended application route
- No sustained Vercel build, edge, or function error increase
- No unexpected domain reassignment or certificate warning

### Railway backend and branded API

Verify the canonical production health surfaces:

- `/health`
- `/health/ready`
- `/health/deep`
- `/health/deployment`
- `/api/v1/health`
- `/api/v1/ops/health`

Observe:

- deployment state
- restart count
- CPU and memory pressure
- 4xx and 5xx rates
- request latency
- dependency health

### Supabase

Observe:

- authentication failures
- database connection errors
- slow queries and lock pressure
- RLS authorization failures
- storage failures
- advisor changes

Do not apply advisor recommendations directly in production without a staged migration and rollback plan.

### Redis

Observe:

- connectivity
- memory use
- eviction activity
- command latency
- restart or failover events

### OpenAI and Pinecone

Observe:

- Chat success rate
- provider 401, 429, and 5xx responses
- embedding failures
- Pinecone index/host discovery failures
- dimension mismatch errors
- RAG ingest, retrieval, and cleanup latency
- provider spend and rate-limit trends

### Contact and email delivery

Observe:

- website form HTTP success/failure
- Resend acceptance and delivery status
- delivery to `admin@d3vonn.io`
- bounce or complaint activity
- repeated submissions or abuse patterns

Run one controlled contact-form canary during the first 24 hours and one during the second day. Use a unique subject tag and do not include sensitive information.

### Sentry and application logs

Observe:

- new unhandled exceptions
- error-rate spikes
- repeated stack traces
- authentication or authorization regressions
- browser-specific failures
- mobile-only failures
- slow transactions

Group duplicate errors before opening multiple incidents.

## Core user journey canaries

Perform these checks without creating persistent test residue:

1. Homepage loads on desktop and mobile.
2. Login succeeds with the dedicated low-privilege audit identity.
3. Anonymous access to protected routes redirects correctly.
4. Authenticated workspace loads.
5. Chat returns a valid bounded response.
6. RAG canary ingests, retrieves, and deletes a uniquely tagged fixture.
7. Contact form submits and the message arrives in `admin@d3vonn.io`.
8. Logout succeeds and the session is invalidated.

## Alert thresholds

Treat the following as incident triggers:

- Public site or API unavailable for 5 consecutive minutes
- Error rate above 2% for 10 minutes on a critical route
- Authentication success below 98% over a meaningful sample
- Chat or RAG success below 95% for 10 minutes
- Repeated Railway restarts or crash loops
- Contact delivery failure on two consecutive controlled canaries
- Any cross-user, cross-workspace, or privilege-boundary violation
- Any confirmed secret exposure

## Incident severity

### P0 — Critical

- security boundary failure
- secret exposure
- data loss or corruption
- widespread authentication failure
- full site or API outage

Action: freeze deployments, revoke exposed credentials if applicable, activate rollback, and record owner/timeline immediately.

### P1 — Major

- Chat/RAG unavailable for most users
- contact delivery completely failing
- sustained 5xx spike
- repeated production restarts

Action: stop nonessential changes, identify the last known-good deployment, and prepare rollback.

### P2 — Degraded

- isolated browser or route failure
- elevated latency
- partial provider degradation with fallback available

Action: open a tracked issue, collect evidence, and schedule a controlled fix.

## Incident response sequence

1. Confirm the symptom from a second independent signal.
2. Record time, affected route, user impact, deployment ID, and commit.
3. Freeze unrelated deployments.
4. Check Vercel, Railway, Supabase, Redis, OpenAI, Pinecone, Resend, and Sentry evidence.
5. Determine whether rollback is safer than forward-fix.
6. Restore the certified v1.0.0 baseline when required.
7. Re-run the affected canary and adjacent critical checks.
8. Document root cause, corrective action, and prevention work.

## First-week follow-up backlog

- Build one consolidated operations dashboard
- Define alert ownership and escalation contacts
- Remove duplicate Snyk integration after a clean surviving canary
- Enable or verify code-scanning/SARIF ingestion
- Stage Supabase index and performance work
- Add latency and provider-cost baselines
- Schedule weekly authenticated audit and AI canary review
- Review Genesis and PRIMETIME only through isolated staging gates

## Known-good references

- v1.0.0 baseline merge commit: `4f31b997c4a8ce704d6ead957eda440d7b3a7b63`
- certified application commit: `ad936db77c18a0fca942a3cc405978344c5db9ca`
- authenticated audit Run: `30706014204`
- launch certification: Issue #599
