# Hermes v3 — Autonomous Governance Layer

Hermes v3 is the production-grade CI policy decision engine for the D3VONN platform. It runs on every pull request and push, evaluating the git diff against a multi-layer governance framework before the pipeline is permitted to continue.

## Architecture

```
GitHub Event (push / PR)
        ↓
Context Builder        (context/github-context.cjs)
   ├── Full PR metadata (title, labels, reviewers, draft status)
   ├── File risk classification (critical / high / medium / low)
   ├── Trufflehog-compatible secret signals
   └── D3VONN agent execution context
        ↓
┌─────────────────────────────────────────────────────┐
│                  Governance Pipeline                │
│                                                     │
│  1. IAM Introspection  (iam/aws-iam.cjs)            │
│     └── Privilege escalation, wildcard grants,      │
│         dangerous policies, cross-account trust     │
│                                                     │
│  2. Risk Heatmap       (heatmap/risk-heatmap.cjs)   │
│     └── Per-file risk scoring, tier classification  │
│         overall risk score (0-100)                  │
│                                                     │
│  3. Agent Firewall     (firewall/agent-firewall.cjs)│
│     └── Permission tier enforcement for all         │
│         D3VONN autonomous agents                 │
│                                                     │
│  4. OPA Policy Engine  (core/opa.cjs)               │
│     └── Deterministic rule evaluation against       │
│         Rego policy packs                           │
└─────────────────────────────────────────────────────┘
        ↓
Decision Contract
   ├── ALLOW  → pipeline continues
   ├── WARN   → pipeline continues + advisory PR comment
   └── DENY   → pipeline blocked (exit 1) + remediation PR comment
        ↓
PR Comment Bot         (bot/pr-comment.cjs)
   └── Posts structured decision report with heatmap,
       IAM findings, remediation steps, and risk score
```

## File Structure

| File | Purpose |
|------|---------|
| `core/engine.cjs` | CI entrypoint — orchestrates the full governance pipeline |
| `core/opa.cjs` | OPA-compatible policy evaluator with deterministic fallback rules |
| `context/github-context.cjs` | Builds structured context from GitHub Actions environment |
| `policies/main.rego` | Main OPA policy bundle |
| `policies/security.rego` | Security-focused deny rules |
| `policies/ci.rego` | CI/CD governance rules |
| `analyzers/` | Shared analyzers from v2 (secrets, terraform, diff) |
| `iam/aws-iam.cjs` | AWS IAM privilege escalation and wildcard grant detector |
| `heatmap/risk-heatmap.cjs` | Per-file risk scoring and Markdown heatmap generator |
| `bot/pr-comment.cjs` | GitHub API PR comment bot with rich Markdown formatting |
| `firewall/agent-firewall.cjs` | D3VONN agent permission tier enforcement |
| `firewall/agent-registry.json` | Agent ID → permission tier registry |
| `tests/hermes-v3.test.cjs` | 37-test unit suite (all passing) |

## Policy Rules

| Rule | Decision | Trigger |
|------|----------|---------|
| Direct push to `main` by human | DENY | `branch == "main"` and actor is not a bot |
| Secrets in diff | DENY | AWS keys, GitHub PATs, private key headers |
| Large IAM change | DENY | IAM files changed AND diff > 8 KB |
| Massive diff | DENY | diff > 50 KB (blast radius too high) |
| Small IAM change | WARN | IAM files changed, diff within limit |
| Infrastructure change | WARN | Terraform/K8s files modified |
| Workflow file changed | WARN | `.github/workflows/` files modified |
| Dependency manifest changed | WARN | `package.json`, `requirements.txt` modified |
| Everything else | ALLOW | No policy violations detected |

## Agent Permission Tiers

| Tier | Level | Permitted Actions |
|------|-------|------------------|
| `read-only` | 1 | Read repo state only |
| `contributor` | 2 | Open PRs, post comments |
| `deployer` | 3 | Deploy to staging, create releases |
| `operator` | 4 | Deploy to production, modify workflows, rotate secrets |
| `admin` | 5 | Full access (platform team only) |

## Running Locally

```bash
# Run unit tests (37 tests)
node hermes/v3/tests/hermes-v3.test.cjs

# Run the full governance pipeline (uses your local git state)
node hermes/v3/core/engine.cjs
```

## Roadmap

| Version | Status | Features |
|---------|--------|---------|
| v2 | Merged (PR #109) | OPA-compatible deterministic policy engine |
| v3 | This PR | IAM introspection, PR comment bot, risk heatmaps, agent firewall |
| v4 | Planned | Real OPA WASM runtime, risk trend dashboards, Slack/PagerDuty alerts |
| v5 | Planned | D3VONN agent mesh integration, autonomous remediation |
