# D3VONN Autonomous Agent Platform Foundation

## Status

This gate establishes a server-side safety foundation. It does not activate any
production tool, deployment path, destructive action, persistent autonomous
run, or unattended approval mechanism.

## Execution boundary

`AgentExecutor` is the authoritative tool-execution boundary. Model output is
treated as untrusted intent and cannot choose its own risk classification.
Every callable tool needs an operator-supplied `ToolRisk` at registration time.
Handlers without an explicit classification remain registered for backward
compatibility but are not presented to the model and fail closed if requested.

The deterministic policy has three outcomes:

| Outcome | Behavior |
| --- | --- |
| `auto` | The bounded handler may execute. |
| `approval_required` | The handler is not invoked. A future approval service may resume the request. |
| `deny` | The handler is not invoked and the observation records the denial. |

Deployments, destructive intent, and production writes require approval. Tool
results and failures are redacted before they return to the model transcript.

## Bounded autonomy

An executor run is limited to one active agent at depth one, ten model steps,
ten tool calls, and five minutes. Tool handlers run behind a hard remaining-time
timeout. The orchestration supervisor accepts at most five registered agents,
creates at most five subtasks, and has a fifteen-minute wall-clock limit across
decomposition, execution, and synthesis.

Orchestration status is owner-scoped. A caller receives `404` for a missing run
and for a run owned by another user, avoiding identifier disclosure.

## Deferred capabilities

Durable run state, approval persistence, audit tables, policy administration,
and production tool registration are deliberately deferred. They require a
separate schema design and rollout gate based on the live environments; the
stale migrations from the superseded proposal are not part of this foundation.
