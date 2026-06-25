# Agent Runtime Validation Harness (Phase B)

Pins the behavioral contract of the D3VONN.IO autonomous-agent runtime so
silent regressions in `AutonomousAgentExecutor`, the memory service, and the
tool-permission boundary get caught by CI.

## Run

```bash
bunx vitest run src/__tests__/runtime
```

## What's covered today (real assertions)

| File | Contract |
|---|---|
| `agent-execution.test.ts` | Status transitions, maxSteps ceiling, `stop()` semantics, resource cleanup, initialize-failure handling |
| `tool-permission-boundaries.test.ts` | `mcpTools` allow-list is honored; empty list = nothing permitted; documents default-open behavior |
| `recovery.test.ts` | Thrown tool errors are caught + recorded; `isError: true` results trigger observation step |
| `memory-persistence.test.ts` | URL shape + req/resp contract with FastAPI memory backend; transport errors propagate |
| `recursive-delegation.test.ts` | `maxSteps` proxy invariant for future recursion layer |

## What's intentionally pending (`.todo`)

| File | Why pending |
|---|---|
| `recursive-delegation.test.ts` (todos) | No sub-agent spawn runtime exists yet |
| `governance-pending.test.ts` | No arbitration / policy engine / snapshot-restore runtime exists yet |

These appear in `vitest` output as outstanding work — they are **not** silent
gaps. Convert each `.todo` into a real suite as the corresponding runtime
module lands.

## Harness primitives

`harness/mcpClientMock.ts` — deterministic stand-in for `McpClient`.
Lets tests inject:
- a fixed tool catalog (`listTools` return)
- per-tool behavior (handlers, throws, `isError` results)
- an `initialize()` failure mode
- a call log (`callLog: { name, args }[]`) for boundary assertions

## Class of risk this eliminates

Before this harness, the autonomous loop could change shape (skip the
`mcpTools` filter, drop the `stop()` flag, swallow tool errors) and only get
caught in production. The harness fails CI before those drift in.

## Roadmap signal

When implementing the arbitration / governance layer, the `.todo` blocks
double as a feature-acceptance checklist: a runtime module is not "done"
until its corresponding suite is converted from `.todo` to passing tests.
