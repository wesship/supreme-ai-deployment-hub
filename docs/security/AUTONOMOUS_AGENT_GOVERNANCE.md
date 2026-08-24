# D3VONN Autonomous Agent Governance

## Safety contract

D3VONN autonomous agents are bounded by deterministic controls before model-generated actions are executed.

1. Unknown tools are denied.
2. Read operations may run automatically when allowlisted.
3. Write operations are budgeted and bounded.
4. Deployment operations require explicit approval.
5. Destructive operations require explicit approval.
6. Agent count, recursion depth, runtime, tool calls, and estimated spend are capped.
7. Provider credentials never belong in browser code or `VITE_` variables.
8. Governance records are persisted server-side for auditability.
9. Tenant-scoped records use RLS; privileged mutations remain server-side.
10. Production promotion remains a separate release decision and is never implied by autonomous success.

## Current limits

| Control | Default |
| --- | ---: |
| Agents/run | 5 |
| Max depth | 3 |
| Tool calls/run | 40 |
| Runtime | 30 minutes |
| Estimated spend/run | $10 |

## Approval model

`read` → automatic when allowlisted.

`write` → automatic only when within budget and allowlisted.

`deploy` → approval required.

`destructive` → approval required.

The policy is deterministic: model output can propose an action but cannot override the policy.

## Rollout sequence

1. Keep the foundation on a non-production branch.
2. Run CI/unit/security checks.
3. Wire the same policy into the authoritative server-side tool dispatcher.
4. Add server-side approval records and audit events.
5. Add sandboxed browser/code execution with explicit domain/filesystem allowlists.
6. Add model routing and cost accounting.
7. Add scheduled goals only after per-run and per-schedule budgets are enforced.
8. Verify staging end-to-end.
9. Promote only after security gates pass.
