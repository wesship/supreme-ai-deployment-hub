/**
 * runtime-validation/scenarios/failure-recovery-replay.test.ts
 *
 * Wave 29: Failure Recovery & Replay Integrity Scenarios
 *
 * These tests validate system behavior under failure conditions using the
 * FailureSimulator, CheckpointManager, ReplayEngine, and CausalGraphBuilder
 * harness primitives. They do NOT call production code — they exercise the
 * harness contracts that the real orchestration layer must satisfy.
 *
 * Test suites:
 *   1. Process crash recovery — agent restarts from last checkpoint
 *   2. Network partition recovery — agent detects and recovers from isolation
 *   3. Replay idempotency — replayed steps produce identical outputs
 *   4. Causal graph integrity — failure injection does not corrupt causal chains
 *   5. Partial write recovery — interrupted memory writes are detected and repaired
 *   6. Governance deadlock recovery — conflicting policies are resolved without escalation loop
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";
import {
  FailureSimulator,
  CheckpointManager,
  ReplayEngine,
  CausalGraphBuilder,
} from "../harness/failureSimulator";
import type { FailureSpec, GovernanceSnapshot } from "../harness/types";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const BASE_GOVERNANCE: GovernanceSnapshot = {
  activePolicies: ["no-pii-exfiltration", "rate-limit-tools"],
  grantedCapabilities: ["read-memory", "write-memory", "call-tools"],
  pendingEscalations: [],
};

const BASE_MEMORY = {
  "ctx:task": "deploy service v2",
  "ctx:step": "3",
  "ctx:last-tool": "kubectl_apply",
};

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Suite 1: Process crash recovery
// ---------------------------------------------------------------------------

describe("Failure recovery — process crash", () => {
  it("agent saves a checkpoint before a crash and restores from it", () => {
    const trace = new TraceEngine("run-crash-1");
    const sim = new FailureSimulator(trace);
    const ckpt = new CheckpointManager(trace);

    // Normal execution up to step 2
    trace.record("executor", "agent_start", { goal: "deploy service v2" });
    trace.record("executor", "tool_call", { tool: "kubectl_apply" });
    trace.record("executor", "tool_result", { tool: "kubectl_apply", success: true });

    // Save checkpoint before the risky step
    const checkpointId = ckpt.save({
      agentId: "executor",
      stepIndex: 3,
      memoryState: BASE_MEMORY,
      governanceState: BASE_GOVERNANCE,
      preFailure: true,
    });

    // Register and inject crash at step 3
    const spec: FailureSpec = {
      failureId: "crash-1",
      mode: "process_crash",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Simulated process crash during deployment",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    const triggered = sim.step("executor");

    expect(triggered).toContain("crash-1");

    // System detects the crash
    sim.recordDetection("crash-1", "executor");

    // Recovery: load checkpoint and resume
    const restored = ckpt.load(checkpointId, "executor");
    expect(restored).toBeDefined();
    expect(restored!.stepIndex).toBe(3);
    expect(restored!.memoryState["ctx:task"]).toBe("deploy service v2");
    expect(restored!.preFailure).toBe(true);

    // Record recovery
    sim.recordRecoveryBegin("crash-1", "executor", [
      "load-checkpoint",
      "verify-memory",
      "resume-from-step-3",
    ]);
    sim.recordRecoveryComplete("crash-1", "executor");

    const result = sim.getResult("crash-1");
    expect(result).toBeDefined();
    expect(result!.recovered).toBe(true);
    expect(result!.recoverySteps).toHaveLength(3);
  });

  it("checkpoint saves the full trace history up to the crash point", () => {
    const trace = new TraceEngine("run-crash-2");
    const ckpt = new CheckpointManager(trace);

    trace.record("planner", "agent_start", { goal: "analyze logs" });
    trace.record("planner", "thought", { summary: "Identify error patterns" });
    trace.record("planner", "tool_call", { tool: "log_reader" });

    const checkpointId = ckpt.save({
      agentId: "planner",
      stepIndex: 3,
      memoryState: { "ctx:logs": "error-pattern-found" },
      governanceState: BASE_GOVERNANCE,
      preFailure: true,
    });

    const checkpoint = ckpt.get(checkpointId);
    // traceHistory is captured BEFORE the checkpoint_saved event is recorded,
    // so it contains only the 3 execution events (not the checkpoint_saved event itself)
    expect(checkpoint!.traceHistory).toHaveLength(3);
    expect(checkpoint!.traceHistory.map((e) => e.kind)).toContain("agent_start");
    // The checkpoint_saved event appears in the trace AFTER the snapshot, not inside it
    const allEvents = trace.allEvents();
    expect(allEvents.some((e) => e.kind === "checkpoint_saved")).toBe(true);
  });

  it("recovery_begin and recovery_complete events appear in the trace", () => {
    const trace = new TraceEngine("run-crash-3");
    const sim = new FailureSimulator(trace);
    const ckpt = new CheckpointManager(trace);

    ckpt.save({
      agentId: "executor",
      stepIndex: 1,
      memoryState: BASE_MEMORY,
      governanceState: BASE_GOVERNANCE,
      preFailure: true,
    });

    const spec: FailureSpec = {
      failureId: "crash-3",
      mode: "process_crash",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Crash at step 1",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("crash-3", "executor");
    sim.recordRecoveryBegin("crash-3", "executor", ["load-checkpoint"]);
    sim.recordRecoveryComplete("crash-3", "executor");

    const events = trace.allEvents();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("failure_injected");
    expect(kinds).toContain("failure_detected");
    expect(kinds).toContain("recovery_begin");
    expect(kinds).toContain("recovery_complete");
  });

  it("unrecoverable crash records recovery_failed in the trace", () => {
    const trace = new TraceEngine("run-crash-4");
    const sim = new FailureSimulator(trace);

    const spec: FailureSpec = {
      failureId: "crash-4",
      mode: "process_crash",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Unrecoverable crash — no checkpoint available",
      expectedRecoverable: false,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("crash-4", "executor");
    sim.recordRecoveryFailed("crash-4", "executor", "no checkpoint available");

    const result = sim.getResult("crash-4");
    expect(result!.recovered).toBe(false);

    const events = trace.allEvents();
    expect(events.some((e) => e.kind === "recovery_failed")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Network partition recovery
// ---------------------------------------------------------------------------

describe("Failure recovery — network partition", () => {
  it("agent detects network partition and suspends tool calls", () => {
    const trace = new TraceEngine("run-net-1");
    const sim = new FailureSimulator(trace);

    const spec: FailureSpec = {
      failureId: "net-1",
      mode: "network_partition",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Network partition during tool call",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);

    trace.record("executor", "agent_start", { goal: "fetch external data" });
    trace.record("executor", "tool_call", { tool: "http_get", url: "https://api.example.com" });

    // Partition injected
    sim.step("executor");
    sim.recordDetection("net-1", "executor");

    // Agent suspends and waits
    trace.record("executor", "observation", {
      summary: "Network unreachable — suspending tool calls",
    });

    // Partition resolves
    trace.record("executor", "observation", { summary: "network_restored" });
    sim.recordRecoveryBegin("net-1", "executor", ["wait-for-network", "retry-tool-call"]);
    sim.recordRecoveryComplete("net-1", "executor");

    const result = sim.getResult("net-1");
    expect(result!.recovered).toBe(true);

    const events = trace.allEvents();
    expect(events.some((e) => e.kind === "failure_injected" && (e.payload as Record<string, unknown>)["mode"] === "network_partition")).toBe(true);
  });

  it("network partition does not corrupt memory state", () => {
    const trace = new TraceEngine("run-net-2");
    const sim = new FailureSimulator(trace);
    const ckpt = new CheckpointManager(trace);

    trace.record("executor", "memory_write", { key: "ctx:status", value: "in-progress" });

    const checkpointId = ckpt.save({
      agentId: "executor",
      stepIndex: 1,
      memoryState: { "ctx:status": "in-progress" },
      governanceState: BASE_GOVERNANCE,
      preFailure: true,
    });

    const spec: FailureSpec = {
      failureId: "net-2",
      mode: "network_partition",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Network partition after memory write",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("net-2", "executor");
    sim.recordRecoveryBegin("net-2", "executor", ["verify-memory", "resume"]);
    sim.recordRecoveryComplete("net-2", "executor");

    // Memory state should be intact from checkpoint
    const checkpoint = ckpt.get(checkpointId);
    expect(checkpoint!.memoryState["ctx:status"]).toBe("in-progress");
  });

  it("multiple network partitions in sequence are each independently tracked", () => {
    const trace = new TraceEngine("run-net-3");
    const sim = new FailureSimulator(trace);

    for (let i = 1; i <= 3; i++) {
      const spec: FailureSpec = {
        failureId: `net-seq-${i}`,
        mode: "network_partition",
        targetAgent: "executor",
        injectAtStep: i - 1,
        description: `Partition ${i}`,
        expectedRecoverable: true,
      };
      sim.registerFailure(spec);
    }

    // Step through 3 steps
    sim.step("executor"); // step 0 → triggers net-seq-1
    sim.step("executor"); // step 1 → triggers net-seq-2
    sim.step("executor"); // step 2 → triggers net-seq-3

    for (let i = 1; i <= 3; i++) {
      sim.recordDetection(`net-seq-${i}`, "executor");
      sim.recordRecoveryBegin(`net-seq-${i}`, "executor", ["retry"]);
      sim.recordRecoveryComplete(`net-seq-${i}`, "executor");
    }

    const results = sim.getAllResults();
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.recovered)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Replay idempotency
// ---------------------------------------------------------------------------

describe("Replay idempotency", () => {
  it("identical step outputs pass idempotency check", () => {
    const trace = new TraceEngine("run-replay-1");
    const engine = new ReplayEngine(trace);

    const report = engine.replay("ckpt-1", [
      {
        eventKind: "tool_call",
        agentId: "executor",
        originalOutput: { tool: "kubectl_apply", args: "--namespace prod" },
        replayOutput: { tool: "kubectl_apply", args: "--namespace prod" },
      },
      {
        eventKind: "tool_result",
        agentId: "executor",
        originalOutput: { success: true, exitCode: 0 },
        replayOutput: { success: true, exitCode: 0 },
      },
    ]);

    expect(report.passed).toBe(true);
    expect(report.totalStepsReplayed).toBe(2);
    expect(report.idempotentSteps).toBe(2);
    expect(report.nonIdempotentSteps).toBe(0);
    expect(report.violations).toHaveLength(0);
  });

  it("diverged step output is flagged as idempotency violation", () => {
    const trace = new TraceEngine("run-replay-2");
    const engine = new ReplayEngine(trace);

    const report = engine.replay("ckpt-2", [
      {
        eventKind: "tool_result",
        agentId: "executor",
        originalOutput: { success: true, exitCode: 0, timestamp: "2026-01-01T00:00:00Z" },
        replayOutput: { success: true, exitCode: 0, timestamp: "2026-01-01T00:01:00Z" },
      },
    ]);

    expect(report.passed).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].divergedFields).toContain("timestamp");
  });

  it("replay_start and replay_end events bracket the replay window in the trace", () => {
    const trace = new TraceEngine("run-replay-3");
    const engine = new ReplayEngine(trace);

    engine.replay("ckpt-3", [
      {
        eventKind: "thought",
        agentId: "planner",
        originalOutput: { summary: "plan step 1" },
        replayOutput: { summary: "plan step 1" },
      },
    ]);

    const events = trace.allEvents();
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe("replay_start");
    expect(kinds[kinds.length - 1]).toBe("replay_end");
  });

  it("idempotency_check events are emitted for each passing step", () => {
    const trace = new TraceEngine("run-replay-4");
    const engine = new ReplayEngine(trace);

    engine.replay("ckpt-4", [
      {
        eventKind: "tool_call",
        agentId: "executor",
        originalOutput: { tool: "read_file", path: "/etc/config" },
        replayOutput: { tool: "read_file", path: "/etc/config" },
      },
      {
        eventKind: "tool_result",
        agentId: "executor",
        originalOutput: { content: "config-value" },
        replayOutput: { content: "config-value" },
      },
    ]);

    const checks = trace.getEventsByKind("idempotency_check");
    expect(checks).toHaveLength(2);
    expect(checks.every((e) => (e.payload as Record<string, unknown>)["passed"] === true)).toBe(true);
  });

  it("idempotency_violation events are emitted for each failing step", () => {
    const trace = new TraceEngine("run-replay-5");
    const engine = new ReplayEngine(trace);

    engine.replay("ckpt-5", [
      {
        eventKind: "tool_result",
        agentId: "executor",
        originalOutput: { result: "value-A" },
        replayOutput: { result: "value-B" },
      },
    ]);

    const violations = trace.getEventsByKind("idempotency_violation");
    expect(violations).toHaveLength(1);
    expect((violations[0].payload as Record<string, unknown>)["divergedFields"]).toContain("result");
  });

  it("replay from checkpoint preserves the checkpoint memory state", () => {
    const trace = new TraceEngine("run-replay-6");
    const ckpt = new CheckpointManager(trace);
    const engine = new ReplayEngine(trace);

    const checkpointId = ckpt.save({
      agentId: "executor",
      stepIndex: 5,
      memoryState: { "ctx:task": "deploy v2", "ctx:step": "5" },
      governanceState: BASE_GOVERNANCE,
      preFailure: false,
    });

    const checkpoint = ckpt.get(checkpointId);
    expect(checkpoint!.memoryState["ctx:task"]).toBe("deploy v2");

    const report = engine.replay(checkpointId, [
      {
        eventKind: "tool_call",
        agentId: "executor",
        originalOutput: { tool: "kubectl_apply" },
        replayOutput: { tool: "kubectl_apply" },
      },
    ]);

    expect(report.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Causal graph integrity
// ---------------------------------------------------------------------------

describe("Causal graph integrity", () => {
  it("a simple linear execution produces an acyclic causal graph", () => {
    const trace = new TraceEngine("run-causal-1");
    const builder = new CausalGraphBuilder();

    trace.record("planner", "agent_start", { goal: "run analysis" });
    trace.record("planner", "tool_call", { tool: "analyzer" });
    trace.record("planner", "tool_result", { tool: "analyzer", success: true });
    trace.record("planner", "agent_stop", { summary: "analysis complete" });

    const events = trace.allEvents();
    // Add explicit causal links
    builder.addLink(events[0].id, events[1].id, "agent started → tool call");
    builder.addLink(events[1].id, events[2].id, "tool call → tool result");
    builder.addLink(events[2].id, events[3].id, "tool result → agent stop");

    const graph = builder.build(events);
    const result = builder.verify(graph);

    expect(result.isAcyclic).toBe(true);
    expect(result.cyclicEvents).toHaveLength(0);
  });

  it("failure injection events are causally linked to their recovery events", () => {
    const trace = new TraceEngine("run-causal-2");
    const sim = new FailureSimulator(trace);
    const builder = new CausalGraphBuilder();

    trace.record("executor", "agent_start", { goal: "deploy" });

    const spec: FailureSpec = {
      failureId: "causal-fail-1",
      mode: "process_crash",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Crash for causal test",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("causal-fail-1", "executor");
    sim.recordRecoveryBegin("causal-fail-1", "executor", ["restore"]);
    sim.recordRecoveryComplete("causal-fail-1", "executor");

    const events = trace.allEvents();
    const injected = events.find((e) => e.kind === "failure_injected")!;
    const detected = events.find((e) => e.kind === "failure_detected")!;
    const recoveryBegin = events.find((e) => e.kind === "recovery_begin")!;
    const recoveryComplete = events.find((e) => e.kind === "recovery_complete")!;

    builder.addLink(injected.id, detected.id, "failure injected → detected");
    builder.addLink(detected.id, recoveryBegin.id, "detected → recovery begin");
    builder.addLink(recoveryBegin.id, recoveryComplete.id, "recovery begin → complete");

    const graph = builder.build(events);
    const result = builder.verify(graph);

    expect(result.isAcyclic).toBe(true);
    // The causal chain from injection to recovery must be intact
    expect(result.cyclicEvents).toHaveLength(0);
  });

  it("a causal cycle is correctly detected", () => {
    const trace = new TraceEngine("run-causal-3");
    const builder = new CausalGraphBuilder();

    trace.record("agent-a", "tool_call", { tool: "tool-x" });
    trace.record("agent-b", "tool_call", { tool: "tool-y" });

    const events = trace.allEvents();
    // Deliberately create a cycle: A → B → A
    builder.addLink(events[0].id, events[1].id, "A calls B");
    builder.addLink(events[1].id, events[0].id, "B calls A (cycle!)");

    const graph = builder.build(events);
    const result = builder.verify(graph);

    expect(result.isAcyclic).toBe(false);
    expect(result.cyclicEvents.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it("all events in a delegation chain are reachable from the root", () => {
    const trace = new TraceEngine("run-causal-4");
    const builder = new CausalGraphBuilder();

    trace.record("planner", "agent_start", { goal: "deploy" });
    trace.pushSpan();
    trace.record("executor", "agent_start", { task: "run deploy" });
    trace.record("executor", "tool_call", { tool: "kubectl_apply" });
    trace.record("executor", "agent_stop", { summary: "done" });
    trace.popSpan();
    trace.record("planner", "agent_stop", { summary: "deployment complete" });

    const events = trace.allEvents();
    // Build causal links from the delegation chain
    for (let i = 1; i < events.length; i++) {
      builder.addLink(events[i - 1].id, events[i].id, "sequential causality");
    }

    const graph = builder.build(events);
    const result = builder.verify(graph);

    expect(result.isAcyclic).toBe(true);
    expect(result.orphanedEvents).toHaveLength(0);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Partial write recovery
// ---------------------------------------------------------------------------

describe("Failure recovery — partial write", () => {
  it("partial write failure is detected and the key is flagged as corrupted", () => {
    const trace = new TraceEngine("run-partial-1");
    const sim = new FailureSimulator(trace);
    const ckpt = new CheckpointManager(trace);

    // Save checkpoint with clean memory
    ckpt.save({
      agentId: "executor",
      stepIndex: 2,
      memoryState: { "ctx:result": "clean-value" },
      governanceState: BASE_GOVERNANCE,
      preFailure: true,
    });

    // Inject partial write failure
    const spec: FailureSpec = {
      failureId: "partial-1",
      mode: "partial_write",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Memory write interrupted mid-operation",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("partial-1", "executor");

    // Recovery: detect corruption and restore from checkpoint
    trace.record("executor", "memory_read", { key: "ctx:result", value: "partial-" });
    trace.record("executor", "observation", {
      summary: "Detected partial write — value is truncated",
    });

    sim.recordRecoveryBegin("partial-1", "executor", [
      "detect-corruption",
      "load-checkpoint",
      "rewrite-key",
    ]);
    sim.recordRecoveryComplete("partial-1", "executor");

    const result = sim.getResult("partial-1");
    expect(result!.recovered).toBe(true);
    expect(result!.recoverySteps).toContain("detect-corruption");
  });

  it("partial write recovery emits the correct trace event sequence", () => {
    const trace = new TraceEngine("run-partial-2");
    const sim = new FailureSimulator(trace);

    const spec: FailureSpec = {
      failureId: "partial-2",
      mode: "partial_write",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Partial write during memory flush",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("partial-2", "executor");
    sim.recordRecoveryBegin("partial-2", "executor", ["restore"]);
    sim.recordRecoveryComplete("partial-2", "executor");

    const events = trace.allEvents();
    const sequence = events.map((e) => e.kind);
    const injIdx = sequence.indexOf("failure_injected");
    const detIdx = sequence.indexOf("failure_detected");
    const begIdx = sequence.indexOf("recovery_begin");
    const cmpIdx = sequence.indexOf("recovery_complete");

    // Events must appear in the correct causal order
    expect(injIdx).toBeLessThan(detIdx);
    expect(detIdx).toBeLessThan(begIdx);
    expect(begIdx).toBeLessThan(cmpIdx);
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Governance deadlock recovery
// ---------------------------------------------------------------------------

describe("Failure recovery — governance deadlock", () => {
  it("conflicting policies trigger a governance_escalate event", () => {
    const trace = new TraceEngine("run-gov-1");
    const sim = new FailureSimulator(trace);

    const spec: FailureSpec = {
      failureId: "gov-deadlock-1",
      mode: "governance_deadlock",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Policy A blocks action; Policy B requires it",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("gov-deadlock-1", "executor");

    // Simulate governance escalation
    trace.record("executor", "governance_escalate", {
      conflictingPolicies: ["no-external-calls", "require-health-check"],
      reason: "Policies are mutually exclusive for this action",
    });

    sim.recordRecoveryBegin("gov-deadlock-1", "executor", [
      "escalate-to-human",
      "await-override",
    ]);
    sim.recordRecoveryComplete("gov-deadlock-1", "executor");

    const escalations = trace.getEventsByKind("governance_escalate");
    expect(escalations).toHaveLength(1);
    expect(
      (escalations[0].payload as Record<string, unknown>)["conflictingPolicies"]
    ).toContain("no-external-calls");
  });

  it("governance deadlock does not cause an infinite escalation loop", () => {
    const trace = new TraceEngine("run-gov-2");
    const sim = new FailureSimulator(trace);

    const spec: FailureSpec = {
      failureId: "gov-deadlock-2",
      mode: "governance_deadlock",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Deadlock that could cause escalation loop",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("gov-deadlock-2", "executor");

    // Simulate a single escalation (not a loop)
    trace.record("executor", "governance_escalate", {
      conflictingPolicies: ["policy-A", "policy-B"],
      reason: "Deadlock",
    });

    sim.recordRecoveryBegin("gov-deadlock-2", "executor", ["single-escalation"]);
    sim.recordRecoveryComplete("gov-deadlock-2", "executor");

    // There should be exactly ONE escalation event, not multiple
    const escalations = trace.getEventsByKind("governance_escalate");
    expect(escalations).toHaveLength(1);
    expect(sim.getResult("gov-deadlock-2")!.recovered).toBe(true);
  });

  it("governance state is preserved after deadlock recovery", () => {
    const trace = new TraceEngine("run-gov-3");
    const sim = new FailureSimulator(trace);
    const ckpt = new CheckpointManager(trace);

    const checkpointId = ckpt.save({
      agentId: "executor",
      stepIndex: 1,
      memoryState: BASE_MEMORY,
      governanceState: {
        activePolicies: ["policy-A", "policy-B"],
        grantedCapabilities: ["read-memory"],
        pendingEscalations: [],
      },
      preFailure: true,
    });

    const spec: FailureSpec = {
      failureId: "gov-deadlock-3",
      mode: "governance_deadlock",
      targetAgent: "executor",
      injectAtStep: 0,
      description: "Deadlock with governance state preservation test",
      expectedRecoverable: true,
    };
    sim.registerFailure(spec);
    sim.step("executor");
    sim.recordDetection("gov-deadlock-3", "executor");
    sim.recordRecoveryBegin("gov-deadlock-3", "executor", ["restore-governance"]);
    sim.recordRecoveryComplete("gov-deadlock-3", "executor");

    // Verify governance state was preserved in the checkpoint
    const checkpoint = ckpt.get(checkpointId);
    expect(checkpoint!.governanceState.activePolicies).toContain("policy-A");
    expect(checkpoint!.governanceState.activePolicies).toContain("policy-B");
    // Capabilities must NOT have been inflated during recovery
    expect(checkpoint!.governanceState.grantedCapabilities).toHaveLength(1);
    expect(checkpoint!.governanceState.grantedCapabilities[0]).toBe("read-memory");
  });
});
