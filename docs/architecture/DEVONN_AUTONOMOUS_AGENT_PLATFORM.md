# D3VONN Autonomous Agent Platform

## Scope

This branch adds the safety foundation for the recommended agent capabilities inspired by modern coding-agent workflows. The goal is to make D3VONN an autonomous platform rather than a single-model chatbot.

## Capability map

1. Browser/research tools — provider-backed, read-first tools with source tracking.
2. Local/cloud execution — isolated execution only; never expose server secrets to a browser agent.
3. Multi-agent orchestration — existing supervisor/graph architecture remains the control plane.
4. Voice — voice commands map to the same authenticated goal/task APIs; voice never bypasses authorization.
5. Publishing — generated artifacts require explicit publish permission and remain private by default.
6. Model routing — route by task complexity, latency, quality and budget rather than hard-coding a single model.
7. Thinking/compute policy — higher-cost reasoning is selected only when task risk/complexity justifies it.
8. Automations — recurring work runs with bounded budgets, timeouts and tool allowlists.
9. Connected apps — OAuth/service integrations are server-side; no third-party secret belongs in VITE_ variables.
10. Reusable skills — versioned skills with declared tools, permissions and expected outputs.
11. Goal execution — goals have measurable completion criteria, max runtime, max depth and human approval gates.
12. Quota/cost control — every autonomous run has agent, tool-call, time and estimated-spend limits.
13. Cross-thread memory — memory is tenant-scoped and retrieved only for the authenticated workspace/user.
14. Local vs cloud execution — execution target is explicit and isolated; production actions remain approval-gated.
15. Remote device control — disabled by default and treated as a high-risk capability requiring explicit opt-in and audit logging.

## Safety model

Model output is untrusted intent. A deterministic policy layer decides whether a proposed action is allowed. Read operations may run automatically; writes are bounded; deployment and destructive operations require approval; unknown tools are denied.

The initial policy lives in `src/services/ai/safetyPolicy.ts`.

## Production gates

- No direct browser access to provider secrets.
- No autonomous production deployment without approval.
- No destructive action without approval.
- No unbounded agent spawning.
- No unbounded tool loops.
- No autonomous run beyond its configured time or estimated spend budget.
- Sensitive logs must be redacted.
- Tenant data must remain protected by Supabase RLS.
- Supabase `SECURITY DEFINER` helpers must be private/restricted and use a pinned search path.

## Rollout order

### Phase A — Safe foundation

- Central policy and budget limits.
- Tenant RLS hardening.
- Audit/approval contract.
- Read-only capabilities first.

### Phase B — Controlled autonomy

- Goal objects and resumable runs.
- Versioned skills.
- Scheduled jobs with per-run budgets.
- Model router and cost accounting.

### Phase C — Advanced execution

- Sandboxed cloud/local code execution.
- Browser automation with domain/tool allowlists.
- Multi-agent parallel execution with depth limits.
- Artifact publishing with explicit approval.

### Phase D — High-risk integrations

- Production deployment.
- Remote computer/device control.
- Secret rotation and destructive infrastructure actions.

Every Phase D operation remains approval-gated and auditable.
