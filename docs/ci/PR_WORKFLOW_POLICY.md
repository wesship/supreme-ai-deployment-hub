# Pull Request Workflow Policy

Only `.github/workflows/required-pr-gate.yml` may run automatically for every pull request targeting `main`.

Specialized workflows such as CodeQL, Lighthouse, accessibility, coverage, deployment, promotion, governance, signing, and infrastructure validation must use one or more of the following:

- `workflow_dispatch`
- scheduled execution
- path-scoped pull request triggers
- release or protected-environment triggers

This policy prevents repository-wide workflow fan-out, duplicate dependency installation, excessive Actions usage, and account-level runner exhaustion.
