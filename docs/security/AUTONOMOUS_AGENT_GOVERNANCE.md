# Autonomous Agent Governance

## Non-negotiable controls

- The backend policy, not the browser or model, authorizes tool execution.
- Tools are deny-by-default until code registers an explicit risk tier.
- Deploy, destructive, and production-write requests stop before handler entry
  and report that approval is required.
- Runtime, agent count, depth, subtask count, model steps, and tool calls are
  bounded in code.
- Credential-shaped tool output and errors are redacted before they enter the
  agent transcript.
- Run status is visible only to the authenticated owner.

## Risk tiers

| Tier | Automatic execution |
| --- | --- |
| Read | Allowed within run budgets. |
| Write | Allowed only outside production and when no destructive intent is present. |
| Deploy | Never; explicit approval is required. |
| Destructive | Never; explicit approval is required. |

Argument inspection is defense in depth: destructive language upgrades any
otherwise lower-risk action to approval-required. It is not a substitute for
accurate operator classification.

## Current operating state

No production tool handlers are registered by this gate. There is no approval
API, stored approval token, governance database table, or autonomous deployment
capability. An `approval_required` result is therefore a safe stop, not an
implicit queue or authorization.

Before a later gate enables a production handler, it must add an authenticated,
single-use approval flow; tamper-evident audit events; least-privilege service
credentials; replay protection; environment-specific rollout controls; and
end-to-end tests proving that a denied or unapproved handler is never invoked.
