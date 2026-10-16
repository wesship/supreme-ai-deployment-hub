# REA Gate 9 — CI blocker triage

Status: HOLD. Do not merge, apply migrations, or enable REA.

## Confirmed CI failures on commit f7c7294a869d

1. **Zero-Downtime Migration**: safety scanner treats the `TRUNCATE` privilege revocation in `20261016001000_rea_audit_append_only.sql` as a critical operation. This is a *false-positive classification of a privilege restriction*, not evidence of a destructive data operation. Do not obfuscate the SQL to bypass the scanner or remove protection without review.
2. **Lighthouse CI**: performance minimum-score assertion failed on the website. The REA changes contain no UI modifications. Investigate baseline and reproducibility separately; do not lower thresholds to pass.

## Required safe repair

- Inspect the migration scanner's parser and add a narrow, tested distinction between `REVOKE ... TRUNCATE` and an executable `TRUNCATE TABLE` statement.
- Add scanner regression fixtures: allow revocation of destructive privileges, reject executable destructive operations, reject disguised destructive operations, and verify comments cannot override detection.
- Preserve append-only audit safeguards; check actual PostgreSQL role privileges and database migration execution on an isolated disposable database.
- Investigate Lighthouse performance against main-branch baseline; do not merge with a failing required performance check.
- Re-run all required CI workflows after the repair.

## Additional production gates

- Production authorization must use a trusted identity and tenant resolver; do not accept caller-supplied approval or revocation state.
- Persist admission and denial audit events transactionally.
- Test cross-tenant denial, revocation races, and absence of direct client grants.
- No isolated REA execution worker exists yet.
