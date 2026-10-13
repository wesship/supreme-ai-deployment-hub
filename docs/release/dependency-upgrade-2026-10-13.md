# Dependency upgrade certification — 2026-10-13

This branch contains automated dependency changes originally committed as `c4b664b80d472866c312f9278d44851146a763d1` with `[skip ci]` in the commit message. That commit's preview deployment success is **not** a substitute for CI certification.

Release requirements before merge or promotion:
- Run the full required pull-request checks on a commit without CI-skip directives.
- Verify frozen-lockfile install, frontend build/typecheck, backend tests, security scanning, and mobile Lighthouse.
- Investigate and resolve any failed, cancelled, pending, or missing required check.
- Validate signed-in flows and production release acceptance independently.

This note is a CI-triggering follow-up commit, not an approval or a waiver. Do not merge or deploy until all gates pass.
