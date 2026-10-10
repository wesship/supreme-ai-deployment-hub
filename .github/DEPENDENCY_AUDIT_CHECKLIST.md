# D3VONN.IO Dependency Audit Checklist

## Tier A — production

- [x] `wesship/supreme-ai-deployment-hub` — PostCSS resolves to 8.5.21; policy documented.
- [ ] Confirm GitHub Advanced Security/Dependabot alerts are enabled.
- [ ] Confirm dependency-review workflow consumes `.github/dependency-review-config.yml`.
- [ ] Confirm branch protection requires dependency review and build checks.

## Tier B — active D3VONN development

Audit these repositories for package manifests, lockfiles, deployment status, existing Dependabot configuration, and resolved PostCSS versions:

- [ ] `wesship/devonn-dashboard`
- [ ] `wesship/devonn-ai-agent-nexus`
- [ ] `wesship/visionclaw`
- [ ] `wesship/openclaw`
- [ ] `wesship/unified-control-studio`
- [ ] `wesship/devonnai`
- [ ] `wesship/gallery`
- [ ] `wesship/jewelry-journey`

For every Node repository:

```bash
pnpm why postcss || npm ls postcss || yarn why postcss
```

Required result: all resolved PostCSS versions are 8.5.12 or newer; target 8.5.21 or newer.

## Tier C — reference forks

- [ ] Identify forks not deployed or actively modified.
- [ ] Sync required forks with upstream.
- [ ] Archive stale forks to reduce Dependabot noise.

## Tier D — experiments

- [ ] Disable production deployments for abandoned experiments.
- [ ] Archive or delete repositories no longer required.

## Merge gate

- [ ] Frozen-lockfile install passes.
- [ ] Lint passes.
- [ ] Type checking passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] Dependency audit passes.
- [ ] Preview styling and responsive layout verified.
- [ ] No client secrets appear in generated bundles.
