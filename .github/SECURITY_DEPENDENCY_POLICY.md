# Dependency Security Policy

## Scope

This policy applies to production, staging, CI, build, deployment, and developer dependencies in D3VONN.IO.

## Required response

- Critical alerts: begin remediation immediately.
- High alerts: remediate within 48 hours.
- Moderate alerts: remediate within 7 days.
- Low alerts: review in the next scheduled dependency cycle.

Development-only dependencies are not automatically exempt. Build and CI dependencies may access deployment credentials, environment variables, source maps, and repository contents.

## Snyk retirement and replacement

D3VONN.IO does not require Snyk for its repository security gates. The Snyk GitHub integration/check is being retired for the `wesship8` account because its paid test allowance is exhausted.

Security controls are **not** being bypassed. The repository uses a layered, no-Snyk assurance stack:

1. **CodeQL SAST** — JavaScript/TypeScript and Python static analysis.
2. **Grype + SBOM** — dependency vulnerability scanning with blocking High/Critical enforcement.
3. **GitHub Dependency Review** — pull-request dependency and license policy checks when the GitHub capability is available.
4. **Gitleaks + TruffleHog OSS** — repository secret detection.
5. **Dependabot** — dependency update and security-alert workflow.
6. Existing repository lint, typecheck, tests, build, and client-secret bundle checks remain required.

Snyk must not be re-added as a required status check. If an old Snyk status remains in GitHub branch protection, remove only that obsolete Snyk requirement after confirming the replacement controls above are active.

## Fast-track merge criteria

A dependency security pull request may be fast-tracked when:

1. It upgrades to a patched version identified by the advisory.
2. It modifies only dependency manifests, lockfiles, or explicitly related configuration.
3. It does not introduce an unrelated major-version upgrade.
4. Required CI, type checking, tests, builds, and security scans pass.
5. Preview deployment and critical UI styling remain correct.

## PostCSS advisory GHSA-6g55-p6wh-862q

- Vulnerable range: versions below 8.5.12 within the affected advisory range.
- Minimum patched version: 8.5.12.
- D3VONN.IO target floor: 8.5.21 or newer.
- Confirm the resolved lockfile version; the package manifest alone is not sufficient.

Verification command:

```bash
pnpm why postcss
pnpm list postcss --depth Infinity
```

No resolved PostCSS version below the patched floor may remain in a production lockfile.

## Validation baseline

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit
```

The existing client-secret bundle scan remains mandatory for production builds.

## Repository tiers

- Tier A — Production: full Dependabot, dependency review, lockfile enforcement, CI, and patch fast-track.
- Tier B — Active development: security alerts plus grouped weekly updates with test-gated merges.
- Tier C — Reference forks: sync upstream or archive when no longer needed.
- Tier D — Experiments: no production deployment; archive or delete abandoned work.
