# Agent OS Controlled Rollout

Agent OS execution must not be enabled broadly merely because the governance PR stack merges. Runtime promotion is evidence-driven and workspace-scoped.

## Phase 0 — CI and migration certification

Required before staging runtime tests:

- Full backend test suite green.
- Security checks green.
- Supabase migration replay for Agent OS policy/approval persistence succeeds from a clean staging baseline.
- No unresolved review threads in the Agent OS PR stack.
- Named and capability dispatch both require authentication and `workspace_id`.
- Unknown tools/capabilities fail closed.

Stop immediately on any authorization, RLS, migration, or audit-evidence failure.

## Phase 1 — Internal staging workspaces only

Use synthetic data and internal users. Do not use production customer, insurance, financial, or confidential records.

Exercise every governed capability with:

1. allowed role + allowed capability;
2. missing permission;
3. wrong agent/capability binding;
4. unknown capability;
5. workspace kill switch enabled;
6. individual agent disabled;
7. approval required with no approval;
8. active approval;
9. expired approval;
10. revoked approval.

Expected invariant: only an explicit `allow` decision can invoke the Agent Mesh.

## Phase 2 — Failure drills

Run controlled fault injection in staging:

- pre-dispatch audit storage unavailable → dispatch must not execute;
- policy store unavailable → request must fail closed;
- provider unavailable → governed decision exists and provider error is surfaced;
- post-execution outcome audit unavailable → provider result remains truthful and server logs the audit failure;
- all candidate agents unhealthy → capability route returns unavailable without execution;
- kill switch toggled during incident → subsequent dispatches stop.

## Phase 3 — Internal canary

Enable a small internal workspace cohort only after Phases 0–2 pass.

Recommended progression:

- 1 internal workspace;
- 5 internal users;
- 10% of eligible internal requests;
- 25%;
- 50%;
- 100% internal traffic.

Do not advance a stage while a governance or audit anomaly is unresolved.

## Required monitoring

Track at minimum:

- decisions by `allow`, `require_approval`, and `deny`;
- deny reason and missing permission frequency;
- approval creation, expiry, revocation, and usage;
- kill-switch activations;
- disabled-agent blocks;
- provider success/failure and latency;
- pre-dispatch audit failures;
- post-execution outcome-audit failures;
- unknown-tool/capability requests;
- authentication/workspace authorization failures.

## Stop conditions

Immediately disable the affected workspace or agent when any of these occur:

- execution without an `allow` decision;
- execution after kill switch activation;
- cross-workspace authorization leakage;
- expired/revoked approval accepted;
- unknown capability reaches a provider;
- decision audit missing before execution;
- material mismatch between requested and executed agent/capability.

## Production gate

Production enablement requires documented evidence that:

- staging failure drills passed;
- rollback/kill-switch drill passed;
- audit evidence is queryable and task-correlated;
- role/permission mapping has been reviewed;
- approval TTL and revocation behavior have been tested;
- provider credentials are scoped to production environment only;
- monitoring/alert ownership is assigned;
- a rollback owner and incident procedure are defined.

Start production with an internal or tightly controlled pilot workspace. Keep the Agent OS workspace kill switch immediately accessible to authorized workspace administrators.
