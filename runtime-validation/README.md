# Runtime Validation Namespace

This directory is the **dedicated runtime validation environment** for the D3VONN.IO platform.
It is intentionally isolated from `production`, `canary`, and the main `src/__tests__/` tree
to prevent remediation cross-talk, observability contamination, replay interference, and
governance metric pollution.

## Architecture

```
runtime-validation/
├── harness/                  # Core harness primitives
│   ├── traceEngine.ts        # Execution DAG capture, correlation IDs, agent lineage
│   ├── scenarioRunner.ts     # Executes named scenarios and emits structured reports
│   └── types.ts              # Shared types: TraceEvent, ExecutionDAG, ScenarioResult
├── scenarios/                # Named test scenarios (Wave 27+)
│   ├── delegation-chain.test.ts      # Planner → executor → auditor chain validation
│   ├── memory-integrity.test.ts      # Cold restart, partial failure, cross-agent isolation
│   ├── failure-recovery.test.ts      # Pod kill, network partition, replay idempotency
│   └── governance-arbitration.test.ts # Conflict detection, capability boundary enforcement
├── reports/                  # Machine-readable scenario output (gitignored at runtime)
│   └── .gitkeep
└── README.md                 # This file
```

## Layer Responsibilities

| Layer              | File                          | Purpose                                                  |
|--------------------|-------------------------------|----------------------------------------------------------|
| Trace Engine       | `harness/traceEngine.ts`      | Capture execution DAG, correlation IDs, agent lineage    |
| Scenario Runner    | `harness/scenarioRunner.ts`   | Execute scenarios, collect results, emit reports         |
| Delegation Chain   | `scenarios/delegation-chain.test.ts` | Validate planner→executor→auditor chains          |
| Memory Integrity   | `scenarios/memory-integrity.test.ts` | Verify persistence across restarts and failures   |
| Failure Recovery   | `scenarios/failure-recovery.test.ts` | Replay correctness, idempotency, graceful degradation |
| Governance         | `scenarios/governance-arbitration.test.ts` | Policy arbitration, capability boundaries   |

## Running

```bash
# All runtime validation scenarios
npx vitest run runtime-validation/

# Single scenario
npx vitest run runtime-validation/scenarios/delegation-chain.test.ts

# With coverage
npx vitest run --coverage runtime-validation/
```

## Design Principles

1. **Execution traces first** — every scenario captures a full DAG, not just pass/fail.
2. **Correlation IDs** — every event carries a `runId` and `spanId` for causality reconstruction.
3. **Deterministic replay** — scenarios must produce identical traces when replayed with the same seed.
4. **Governance is external** — the arbitration layer is tested independently of the executor.
5. **No production side-effects** — all scenarios use mocked transports; no real network calls.

## Roadmap

| Wave | Focus                          | Status      |
|------|--------------------------------|-------------|
| 27   | Harness scaffolding + trace engine | ✅ Complete |
| 28   | Memory persistence validation  | Planned     |
| 29   | Failure recovery & replay      | Planned     |
| 30   | Governance arbitration         | Planned     |
| 31   | Observability integration      | Planned     |
