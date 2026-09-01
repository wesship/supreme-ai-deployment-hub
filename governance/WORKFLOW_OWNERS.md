# Workflow Owners

Each workflow MUST have a named owner accountable for green CI and on-call response.
Update this file whenever a workflow is added, renamed, or transferred.

| Workflow | Owner | Category | Notes |
|---|---|---|---|
| `build.yml` | @core-platform | ci | primary build gate |
| `auto-merge.yml` | @core-platform | governance | Dependabot-only native auto-merge configuration |
| `dependabot-auto-merge-guard.yml` | @core-platform | governance | blocks risky majors |
| `production-lock.yml` *(future)* | @core-platform | governance | runs `scripts/production-lock.sh` |
| `azure-container-apps-deploy.yml` | @infra | deploy | main branch only |
| `ai-model-governance.yml` | @ai-platform | governance | model-card drift |
| `ai-safety-guardrails.yml` | @ai-platform | security | prompt-injection scans |
| `accessibility.yml` | @design-systems | ci | a11y audits |
| `chaos-engineering.yml` | @sre | monitoring | scheduled |
| _other 97_ | **UNCLAIMED** | — | assign before lock |

## Rules

- No workflow may run on `main` without a listed owner.
- Workflows missing from this table will be flagged by `scripts/workflow-audit/inventory.sh` after consolidation.
- Transfers require a PR + reviewer from the receiving team.
