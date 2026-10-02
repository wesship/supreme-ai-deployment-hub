# Audit release hardening

This change addresses the six release gaps identified against main commit
`a6b6df67b53cd83c879b43850f7a71e591762e3b`.

## Execution safety

Containment approval binds action type, target, agent, parameters and execution
relevant details using a canonical SHA-256 digest. Approval requires a human
identity, timezone-aware approval/expiry timestamps and a valid 15-minute window.
The executor validates the payload and expiry both before and immediately after
its atomic claim. Changed, expired, incomplete and replayed actions cannot run.
Existing approvals without this metadata require a new approval. Real containment
flags remain disabled until operational certification is complete.

Rate limits use the ASGI client address, independent of unvalidated bearer tokens
and raw forwarded headers. Trusted reverse proxies must be configured at the ASGI
server boundary; arbitrary clients must not be trusted to provide their address.
Redis failure remains fail-closed in staging and production.

## Telemetry and startup contract

`GET /api/public/stats` is registered in the canonical Railway application and has
an explicit Vercel rewrite. The `public-stats-v1` contract reports unavailable
measurements as null, health as unknown, and source availability explicitly.
Completed workflow counts come from completed `workflow_runs`; processed task
counts come from terminal `hermes_tasks`. Active agents are inferred from the latest
event per agent within the most recent 200 activity records, with that limitation
included in the response. Queue counts come from pending approval records. No
uptime or health percentage is invented. Cached observations are marked cached
and the frontend does not describe them as live.

Required chat, retrieval, voice, runtime identity, Hermes, approval and public
telemetry router imports fail visibly. Startup verifies required nested routes
and methods; optional router failures emit warnings.

## Enforced evidence

Production dependency audit is blocking at high severity in the required PR gate
and the testing workflow. Patched Axios and transitive overrides yield zero
production advisories in the local audit. Global frontend coverage now enforces
the measured baseline (9% lines/statements, 8% functions, 7% branches). This is
still low overall coverage. Each approval, rate-limit and public telemetry module
separately must meet 90%; the coverage workflow no longer treats failures as advice.

Frontend builds publish the git commit in `/health.json`. Desktop, mobile,
authenticated workspace, Hermes and real voice certifications wait for that exact
commit in both API runtime identity and frontend health. Persistent workers
publish their own commit in heartbeat metadata. The Hermes canary authenticates
with the protected test operator, creates and reads its task through the API, and
observes a same-commit worker completing and releasing a persistent lease.
Storage service authority is used only to observe worker and lease evidence.
Voice tests require an actual signed-out and authenticated WebRTC lifecycle and
an authenticated inline assistant with the Hermes tool.

`Production Release Acceptance` succeeds only after all five production workflows
pass for the same commit. This status does not itself change branch protection or
turn on containment. The existing required PR check now includes the blocking
security and coverage gates.

## Local validation

- General backend suite: 1,077 passed; Hermes suite: 156 passed.
- Final focused release suite: 86 passed; canary authentication regressions: 4 passed.
- Frontend: 826 passed, 10 skipped; coverage 9.50% lines, 9.71% statements,
  8.81% functions and 7.76% branches.
- Security modules: approval 92.75%, rate limiting 94.34%, telemetry 100%.
- TypeScript, ESLint (existing warnings), production build, bundle credential scan,
  secret scan, workflow YAML/action-reference validation, workflow audit and CI
  doctor passed.
- Local desktop/mobile Chromium preview: no tested WCAG A/AA violations and no
  horizontal mobile overflow. These checks do not replace the production suites.

Production deployment and protected credential certification must be evidenced by
the release workflows; local tests do not certify the live release.
