# CI/CD Workflow Risk Priority

Tracking: #624

## Critical — inspect before any change

- Promotion and deployment workflows
- Production environment workflows
- Workflows with `contents: write`, `actions: write`, `deployments: write`, `packages: write`, `id-token: write`, `security-events: write`, or pull-request mutation permissions
- Secret-backed certification and provider canaries
- Autonomous remediation, self-healing, failover, and rollback workflows
- Required PR gate aggregators

## High

- Dependency auto-upgrade and auto-merge workflows
- Scheduled production probes running every 5–30 minutes
- Security, SBOM, provenance, container, and runner-isolation workflows
- Database migration and Supabase deployment workflows
- VPS and multi-cloud deployment paths

## Medium

- Read-only production certification
- Performance, Lighthouse, accessibility, coverage, and analytics reports
- Documentation generation and architecture inventories
- Release notes and reporting workflows

## Low

- Manual metadata-only reporting
- Static linting without elevated permissions
- Developer guidance and non-mutating issue templates

## First consolidation candidates after Phase A

Only evaluate workflows that are all of the following:

1. read-only;
2. not required by branch protection or rulesets;
3. not production-environment protected;
4. do not upload unique evidence;
5. perform materially identical probes;
6. can be restored by reverting one PR.

Deployment, promotion, security, and mutation-capable workflows are explicitly last.
