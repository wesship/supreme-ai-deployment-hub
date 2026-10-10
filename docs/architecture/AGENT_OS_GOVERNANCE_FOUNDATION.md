# D3VONN Agent Operating System — Governance Foundation

The existing Agent Mesh remains the execution fabric. The Agent OS sits in front
of dispatch and decides whether a requested action may run, requires human
approval, or must be denied.

## Canonical flow

```text
Authenticated actor
  -> workspace context
  -> AgentActionRequest
  -> governance evaluation
     -> deny
     -> require approval
     -> allow
  -> existing Agent Mesh
  -> Hermes/agent/provider execution
  -> existing audit/event surfaces
```

## Phase 1 contracts

- Workspace identity is mandatory.
- Actor identity is mandatory.
- Every action declares required permissions.
- Every action has an explicit risk level.
- External side effects require approval unless an explicit approval exists.
- Sensitive-data actions require approval unless an explicit approval exists.
- Critical-risk actions fail closed and cannot be made autonomous by a generic approval.
- Workspace kill switches and per-agent disablement override every other rule.

## Reuse boundaries

- Do not replace `backend.mesh.agent_mesh`.
- Do not create a second worker/scheduler; use Hermes where durable execution is needed.
- Do not create new persistence in this foundation PR.
- Reuse existing workspace membership, approvals, audit events, and feature flags where available.
- Keep insurance, payments, communications, and other regulated/irreversible actions supervised by default.

## Planned follow-up slices

1. Resolve real workspace permissions and kill-switch state from governed storage.
2. Add an approval adapter over the existing approval system.
3. Insert this evaluator immediately before `/api/agents/dispatch` and capability dispatch.
4. Add a typed tool registry with risk/permission metadata.
5. Record governance decision evidence alongside execution/audit records.
6. Add evaluation policies and versioned agent manifests after the dispatch boundary is governed.

No production dispatch behavior changes in this foundation slice.
