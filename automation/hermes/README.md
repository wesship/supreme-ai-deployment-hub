# Hermes v2 — Policy Gate

Hermes is a deterministic CI policy decision engine for the D3VONN platform. It runs on every pull request and push, evaluating the git diff against a set of governance rules before allowing the pipeline to continue.

## Architecture

```
GitHub Event (push / PR)
        ↓
Context Builder  (hermes/context/github-context.js)
        ↓
Policy Engine    (hermes/core/opa.js)
        ↓
Decision Contract
   ├── ALLOW  → pipeline continues
   ├── WARN   → pipeline continues with advisory message
   └── DENY   → pipeline blocked (exit 1)
```

## File Structure

| File | Purpose |
|------|---------|
| `core/engine.js` | CI entrypoint — builds context, evaluates policy, enforces decision |
| `core/opa.js` | OPA-style policy evaluator with deterministic fallback rules |
| `context/github-context.js` | Builds structured context from GitHub Actions environment + git diff |
| `policies/main.rego` | Main OPA policy bundle |
| `policies/security.rego` | Security-focused deny rules |
| `policies/ci.rego` | CI/CD governance rules |
| `analyzers/secrets.js` | Secret pattern scanner |
| `analyzers/terraform.js` | Terraform-aware diff analyzer |
| `analyzers/diff.js` | General-purpose diff metadata parser |
| `tests/hermes.test.js` | Unit test suite (no external dependencies) |

## Policy Rules

| Rule | Type | Trigger |
|------|------|---------|
| Direct push to `main` by human | DENY | `branch == "main"` and actor is not a bot |
| Secrets in diff | DENY | AWS keys, GitHub PATs, private key headers, etc. |
| Large infra change | DENY | Terraform files changed AND diff > 8 KB |
| Small infra change | WARN | Terraform files changed, diff within limit |
| Workflow file changed | WARN | `.github/workflows/` files modified |
| Dependency manifest changed | WARN | `package.json`, `requirements.txt`, etc. modified |
| Everything else | ALLOW | No policy violations detected |

## Running Locally

```bash
# Run unit tests
node hermes/tests/hermes.test.js

# Run the full policy gate (uses your local git state)
node hermes/core/engine.js
```

## Roadmap

- **v2 (current):** OPA-compatible deterministic policy engine with structured risk signals
- **v3:** Real OPA WASM runtime, PR comment bot, risk heatmaps, AWS IAM introspection
- **v4:** D3VONN agent execution firewall integration
