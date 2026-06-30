/**
 * runtime-validation/scenarios/memory-continuity.test.ts
 *
 * Wave 28 — Memory Continuity Validation
 *
 * Core objective: prove that the system can reconstruct execution truth
 * after interruption. Memory is not validated as "stored" — it is validated
 * as "reconstructable in execution context."
 *
 * Test dimensions:
 *   1. Cross-execution memory consistency (same task resumed after restart)
 *   2. Governance-state persistence (policy constraints survive restart)
 *   3. Vector drift detection (embedding divergence over time)
 *   4. Partial failure recovery with memory integrity
 *
 * All tests use the TraceEngine + MemoryReplayValidator harness primitives.
 * No production code is called; these tests pin the behavioral contract
 * that the real AgentMemoryService + executor snapshot API must satisfy.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";
import { MemoryReplayValidator, type RecoveredMemoryStore } from "../harness/memoryReplayValidator";
import type { MemorySnapshot, MemorySnapshotEntry, GovernanceSnapshot } from "../harness/types";

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeGovernanceState(opts: Partial<GovernanceSnapshot> = {}): GovernanceSnapshot {
  return {
    activePolicies: opts.activePolicies ?? ["deployment-gate", "read-only-prod"],
    grantedCapabilities: opts.grantedCapabilities ?? ["web_search", "read_file"],
    pendingEscalations: opts.pendingEscalations ?? [],
  };
}

function makeEntry(content: string, embedding?: number[]): MemorySnapshotEntry {
  return {
    key: "",  // will be set by caller
    content,
    embedding,
    writtenAt: new Date().toISOString(),
  };
}

function buildSnapshot(
  trace: TraceEngine,
  agentId: string,
  entries: Record<string, string>,
  opts: {
    stepIndex?: number;
    embeddings?: Record<string, number[]>;
    governanceState?: GovernanceSnapshot;
  } = {}
): string {
  const memoryEntries: Record<string, MemorySnapshotEntry> = {};
  for (const [key, content] of Object.entries(entries)) {
    memoryEntries[key] = {
      key,
      content,
      embedding: opts.embeddings?.[key],
      writtenAt: new Date().toISOString(),
    };
  }
  return trace.captureSnapshot(agentId, {
    agentId,
    memoryEntries,
    governanceState: opts.governanceState ?? makeGovernanceState(),
    stepIndex: opts.stepIndex ?? 0,
  });
}

function buildRecoveredStore(entries: Record<string, string>, embeddings?: Record<string, number[]>): RecoveredMemoryStore {
  const store: RecoveredMemoryStore = new Map();
  for (const [key, content] of Object.entries(entries)) {
    store.set(key, {
      key,
      content,
      embedding: embeddings?.[key],
      writtenAt: new Date().toISOString(),
    });
  }
  return store;
}

// ---------------------------------------------------------------------------
// 1. Cross-execution memory consistency
// ---------------------------------------------------------------------------

describe("Memory continuity — cross-execution consistency", () => {
  it("all memory entries are fully recovered after a clean restart", () => {
    const trace = new TraceEngine("mem-cross-exec");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "task:goal": "deploy service v3",
      "task:step": "3",
      "task:context": "previous deployment succeeded",
    });

    const endRestart = trace.simulateRestart("executor");
    const recovered = buildRecoveredStore({
      "task:goal": "deploy service v3",
      "task:step": "3",
      "task:context": "previous deployment succeeded",
    });
    endRestart();

    const snapshot = trace.getSnapshot(snapshotId)!;
    trace.recordRestore("executor", snapshotId, true);

    const result = validator.compare(snapshot, recovered, "executor");

    expect(result.memoryFullyRecovered).toBe(true);
    expect(result.missingKeys).toHaveLength(0);
    expect(result.divergedKeys).toHaveLength(0);
    expect(result.driftScore).toBe(0);
  });

  it("trace records restart_begin and restart_complete events", () => {
    const trace = new TraceEngine("mem-restart-events");

    buildSnapshot(trace, "executor", { "key": "value" });
    const endRestart = trace.simulateRestart("executor");
    endRestart();

    expect(trace.getEventsByKind("restart_begin")).toHaveLength(1);
    expect(trace.getEventsByKind("restart_complete")).toHaveLength(1);
  });

  it("task lineage is preserved across restart boundary", () => {
    const trace = new TraceEngine("mem-lineage-preserved");

    trace.record("planner", "agent_start", { goal: "deploy v3" });
    trace.record("planner", "delegation", { targetAgentId: "executor", summary: "execute" });
    trace.pushSpan();
    trace.record("executor", "agent_start", { task: "deploy" });

    const snapshotId = buildSnapshot(trace, "executor", {
      "run:lineage": JSON.stringify(["planner", "executor"]),
      "run:step": "2",
    }, { stepIndex: 2 });

    const endRestart = trace.simulateRestart("executor");
    endRestart();

    const recovered = buildRecoveredStore({
      "run:lineage": JSON.stringify(["planner", "executor"]),
      "run:step": "2",
    });

    const snapshot = trace.getSnapshot(snapshotId)!;
    const validator = new MemoryReplayValidator(trace);
    const result = validator.compare(snapshot, recovered, "executor");

    expect(result.memoryFullyRecovered).toBe(true);
    const lineage = JSON.parse(recovered.get("run:lineage")!.content);
    expect(lineage).toContain("planner");
    expect(lineage).toContain("executor");
  });

  it("step index is preserved in snapshot and recoverable", () => {
    const trace = new TraceEngine("mem-step-index");
    const snapshotId = buildSnapshot(trace, "executor", { "ctx": "data" }, { stepIndex: 7 });
    const snapshot = trace.getSnapshot(snapshotId)!;
    expect(snapshot.stepIndex).toBe(7);
  });

  it("snapshot event is recorded in the trace with correct key count", () => {
    const trace = new TraceEngine("mem-snapshot-event");
    buildSnapshot(trace, "executor", { "a": "1", "b": "2", "c": "3" });

    const snapEvents = trace.getEventsByKind("memory_snapshot");
    expect(snapEvents).toHaveLength(1);
    expect(snapEvents[0].payload.keyCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Governance-state persistence
// ---------------------------------------------------------------------------

describe("Memory continuity — governance-state persistence", () => {
  it("active policies survive restart and are present in the snapshot", () => {
    const trace = new TraceEngine("gov-persist");
    const validator = new MemoryReplayValidator(trace);

    const govState = makeGovernanceState({
      activePolicies: ["deployment-gate", "read-only-prod", "rate-limit-api"],
      grantedCapabilities: ["web_search"],
    });

    const snapshotId = buildSnapshot(trace, "executor", { "ctx": "data" }, { governanceState: govState });
    const snapshot = trace.getSnapshot(snapshotId)!;

    expect(snapshot.governanceState.activePolicies).toContain("deployment-gate");
    expect(snapshot.governanceState.activePolicies).toContain("read-only-prod");

    const recovered = buildRecoveredStore({ "ctx": "data" });
    const result = validator.compare(snapshot, recovered, "executor");

    // Governance state preserved = at least one active policy in snapshot
    expect(result.governanceStatePreserved).toBe(true);
  });

  it("pending escalations in snapshot trigger a governance_escalate trace event", () => {
    const trace = new TraceEngine("gov-escalation-persist");
    const validator = new MemoryReplayValidator(trace);

    const govState = makeGovernanceState({
      activePolicies: ["deployment-gate"],
      pendingEscalations: ["human-review-required:deploy-prod"],
    });

    const snapshotId = buildSnapshot(trace, "executor", { "ctx": "data" }, { governanceState: govState });
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore({ "ctx": "data" });

    validator.compare(snapshot, recovered, "executor");

    // Pending escalations must trigger a governance_escalate event
    expect(trace.wasEscalated()).toBe(true);
    const escalations = trace.getEventsByKind("governance_escalate");
    expect(escalations[0].payload.reason).toMatch(/escalations must survive restart/);
  });

  it("no privilege inflation: recovered capabilities must not exceed snapshot capabilities", () => {
    const trace = new TraceEngine("gov-no-inflation");

    const govState = makeGovernanceState({
      grantedCapabilities: ["web_search", "read_file"],
    });

    const snapshotId = buildSnapshot(trace, "executor", { "ctx": "data" }, { governanceState: govState });
    const snapshot = trace.getSnapshot(snapshotId)!;

    // Simulate a recovered state that attempts to inflate capabilities
    const inflatedCapabilities = ["web_search", "read_file", "write_file", "exec_shell"];
    const inflated = inflatedCapabilities.filter(
      (cap) => !snapshot.governanceState.grantedCapabilities.includes(cap)
    );

    expect(inflated.length).toBeGreaterThan(0); // there ARE inflated capabilities
    // The harness documents this contract: the real system must reject inflated capabilities.
    // This test pins that the snapshot is the authoritative capability boundary.
    expect(snapshot.governanceState.grantedCapabilities).not.toContain("exec_shell");
    expect(snapshot.governanceState.grantedCapabilities).not.toContain("write_file");
  });

  it("governance_check event is emitted during replay comparison", () => {
    const trace = new TraceEngine("gov-check-on-replay");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", { "ctx": "data" });
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore({ "ctx": "data" });

    validator.compare(snapshot, recovered, "executor");

    const govChecks = trace.getEventsByKind("governance_check");
    expect(govChecks.some((e) => e.payload.policy === "post-restart-governance-integrity")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Vector drift detection
// ---------------------------------------------------------------------------

describe("Memory continuity — vector drift detection", () => {
  it("identical embeddings produce zero drift score", () => {
    const trace = new TraceEngine("drift-zero");
    const validator = new MemoryReplayValidator(trace);

    const embedding = [0.1, 0.9, 0.3, 0.7];
    const snapshotId = buildSnapshot(trace, "executor",
      { "ctx:embedding": "deploy context" },
      { embeddings: { "ctx:embedding": embedding } }
    );
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore(
      { "ctx:embedding": "deploy context" },
      { "ctx:embedding": embedding }
    );

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.driftScore).toBe(0);
    expect(result.divergedKeys).toHaveLength(0);
    expect(trace.hasDrift()).toBe(false);
  });

  it("significantly diverged embeddings are flagged as drift", () => {
    const trace = new TraceEngine("drift-detected");
    const validator = new MemoryReplayValidator(trace, { driftThreshold: 0.95 });

    const originalEmbedding = [1.0, 0.0, 0.0, 0.0];
    const divergedEmbedding = [0.0, 1.0, 0.0, 0.0]; // orthogonal = cosine similarity 0

    const snapshotId = buildSnapshot(trace, "executor",
      { "ctx:embedding": "original context" },
      { embeddings: { "ctx:embedding": originalEmbedding } }
    );
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore(
      { "ctx:embedding": "original context" },
      { "ctx:embedding": divergedEmbedding }
    );

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.divergedKeys).toHaveLength(1);
    expect(result.divergedKeys[0].key).toBe("ctx:embedding");
    expect(result.divergedKeys[0].embeddingSimilarity).toBe(0);
    expect(trace.hasDrift()).toBe(true);
  });

  it("content drift without embeddings is also detected", () => {
    const trace = new TraceEngine("drift-content");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "task:goal": "deploy service v3",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore({
      "task:goal": "deploy service v4",  // content changed
    });

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.divergedKeys).toHaveLength(1);
    expect(result.divergedKeys[0].expected).toBe("deploy service v3");
    expect(result.divergedKeys[0].actual).toBe("deploy service v4");
    expect(result.driftScore).toBeGreaterThan(0);
  });

  it("drift events are recorded in the trace with key and expected/actual values", () => {
    const trace = new TraceEngine("drift-trace-events");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", { "key-a": "original" });
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore({ "key-a": "corrupted" });

    validator.compare(snapshot, recovered, "executor");

    const driftEvents = trace.getDriftEvents("key-a");
    expect(driftEvents).toHaveLength(1);
    expect(driftEvents[0].payload.expected).toBe("original");
    expect(driftEvents[0].payload.actual).toBe("corrupted");
  });

  it("drift score is proportional to the number of diverged keys", () => {
    const trace = new TraceEngine("drift-proportional");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "key-1": "value-1",
      "key-2": "value-2",
      "key-3": "value-3",
      "key-4": "value-4",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;
    // 2 of 4 keys diverged
    const recovered = buildRecoveredStore({
      "key-1": "value-1",          // ok
      "key-2": "CORRUPTED",        // diverged
      "key-3": "value-3",          // ok
      "key-4": "ALSO-CORRUPTED",   // diverged
    });

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.driftScore).toBe(0.5); // 2/4
    expect(result.divergedKeys).toHaveLength(2);
  });

  it("stale context reuse: snapshot from an older run is flagged as drift when replayed in new context", () => {
    const trace = new TraceEngine("drift-stale-context");
    const validator = new MemoryReplayValidator(trace);

    // Snapshot from run 1
    const snapshotId = buildSnapshot(trace, "executor", {
      "run:id": "run-001",
      "task:goal": "deploy v1",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;

    // Recovered state is from run 2 (stale context reuse)
    const recovered = buildRecoveredStore({
      "run:id": "run-002",    // different run ID
      "task:goal": "deploy v1",
    });

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.divergedKeys.some((d) => d.key === "run:id")).toBe(true);
    expect(result.memoryFullyRecovered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Partial failure recovery with memory integrity
// ---------------------------------------------------------------------------

describe("Memory continuity — partial failure recovery", () => {
  it("missing keys after partial failure are reported in comparison", () => {
    const trace = new TraceEngine("partial-fail-missing");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "key-a": "value-a",
      "key-b": "value-b",
      "key-c": "value-c",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;

    // Partial recovery: key-b was lost in the crash
    const recovered = buildRecoveredStore({
      "key-a": "value-a",
      "key-c": "value-c",
    });

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.missingKeys).toContain("key-b");
    expect(result.memoryFullyRecovered).toBe(false);
    expect(result.driftScore).toBeGreaterThan(0);
  });

  it("drift events are emitted for missing keys", () => {
    const trace = new TraceEngine("partial-fail-drift-events");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "lost-key": "important-data",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;
    const recovered = buildRecoveredStore({}); // empty recovery

    validator.compare(snapshot, recovered, "executor");

    const driftEvents = trace.getDriftEvents("lost-key");
    expect(driftEvents).toHaveLength(1);
    expect(driftEvents[0].payload.actual).toBe("(missing)");
  });

  it("unexpected keys in recovered store are noted but not counted as drift", () => {
    const trace = new TraceEngine("partial-fail-unexpected");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", { "key-a": "value-a" });
    const snapshot = trace.getSnapshot(snapshotId)!;

    // Recovery has an extra key not in the snapshot
    const recovered = buildRecoveredStore({
      "key-a": "value-a",
      "unexpected-key": "injected-data",
    });

    const result = validator.compare(snapshot, recovered, "executor");
    expect(result.unexpectedKeys).toContain("unexpected-key");
    expect(result.driftScore).toBe(0); // unexpected keys don't count as drift
    expect(result.memoryFullyRecovered).toBe(true); // expected keys are all present
  });

  it("full recovery after partial failure: drift score returns to zero", () => {
    const trace = new TraceEngine("partial-fail-full-recovery");
    const validator = new MemoryReplayValidator(trace);

    const snapshotId = buildSnapshot(trace, "executor", {
      "key-a": "value-a",
      "key-b": "value-b",
    });
    const snapshot = trace.getSnapshot(snapshotId)!;

    // First recovery attempt: partial
    const partialRecovery = buildRecoveredStore({ "key-a": "value-a" });
    const partial = validator.compare(snapshot, partialRecovery, "executor");
    expect(partial.memoryFullyRecovered).toBe(false);

    // Second recovery attempt: complete
    const fullRecovery = buildRecoveredStore({
      "key-a": "value-a",
      "key-b": "value-b",
    });
    const full = validator.compare(snapshot, fullRecovery, "executor");
    expect(full.memoryFullyRecovered).toBe(true);
    expect(full.driftScore).toBe(0);
  });

  it("restart simulation brackets the failure window in the trace", () => {
    const trace = new TraceEngine("partial-fail-brackets");

    buildSnapshot(trace, "executor", { "key": "value" });
    const endRestart = trace.simulateRestart("executor");

    // Simulate partial work during restart
    trace.record("executor", "error", { summary: "partial-write-failed", message: "disk full" });

    endRestart();
    trace.recordRestore("executor", "snap-id", false); // restore failed

    const restartBegin = trace.getEventsByKind("restart_begin");
    const restartComplete = trace.getEventsByKind("restart_complete");
    const errors = trace.getEventsByKind("error");

    expect(restartBegin).toHaveLength(1);
    expect(restartComplete).toHaveLength(1);
    expect(errors).toHaveLength(1);

    // Error must occur between restart_begin and restart_complete
    expect(errors[0].timestamp >= restartBegin[0].timestamp).toBe(true);
    expect(errors[0].timestamp <= restartComplete[0].timestamp).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Replay determinism (Wave 28 extension of Wave 27 principle)
// ---------------------------------------------------------------------------

describe("Memory continuity — replay determinism", () => {
  it("two identical snapshot-and-restore sequences produce the same drift score", () => {
    function runSequence(runId: string) {
      resetIdSequence();
      const trace = new TraceEngine(runId);
      const validator = new MemoryReplayValidator(trace);

      const snapshotId = buildSnapshot(trace, "executor", {
        "key-a": "value-a",
        "key-b": "value-b",
      });
      const snapshot = trace.getSnapshot(snapshotId)!;
      const recovered = buildRecoveredStore({ "key-a": "value-a", "key-b": "value-b" });
      return validator.compare(snapshot, recovered, "executor");
    }

    const r1 = runSequence("replay-det-1");
    const r2 = runSequence("replay-det-2");

    expect(r1.driftScore).toBe(r2.driftScore);
    expect(r1.memoryFullyRecovered).toBe(r2.memoryFullyRecovered);
    expect(r1.missingKeys.length).toBe(r2.missingKeys.length);
  });
});
