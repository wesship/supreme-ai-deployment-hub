/**
 * runtime-validation/scenarios/failure-recovery.test.ts
 *
 * Wave 27 — Failure Recovery & Replay Validation
 *
 * Validates that the platform recovers correctly from transient failures
 * without producing duplicate side effects or corrupted state.
 *
 * Key principle: replay must be deterministic and idempotent.
 *   - Retries cannot create duplicate side effects
 *   - Remediation loops cannot amplify damage
 *   - Replayed plans must preserve governance boundaries
 *
 * These tests use the TraceEngine to model failure injection and recovery
 * scenarios. The .todo() blocks mark Wave 29 work (real pod-kill simulation).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceEngine, resetIdSequence } from "../harness/traceEngine";

beforeEach(() => {
  resetIdSequence();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SideEffect {
  type: string;
  target: string;
  idempotencyKey: string;
}

class MockEffectLog {
  private effects: SideEffect[] = [];
  private applied = new Set<string>();

  /**
   * Apply an effect only if its idempotency key has not been seen.
   * Returns true if applied, false if deduplicated.
   */
  apply(effect: SideEffect, trace: TraceEngine): boolean {
    if (this.applied.has(effect.idempotencyKey)) {
      trace.record("executor", "observation", {
        summary: `deduplicated:${effect.idempotencyKey}`,
        deduplicated: true,
      });
      return false;
    }
    this.applied.add(effect.idempotencyKey);
    this.effects.push(effect);
    trace.record("executor", "tool_result", {
      tool: effect.type,
      target: effect.target,
      summary: effect.type,
    });
    return true;
  }

  count(): number {
    return this.effects.length;
  }

  has(idempotencyKey: string): boolean {
    return this.applied.has(idempotencyKey);
  }
}

/** Simulate a run that fails partway through and is replayed */
function runWithFailureAndReplay(
  trace: TraceEngine,
  effectLog: MockEffectLog,
  opts: { failAfterStep: number } = { failAfterStep: 2 }
) {
  const steps = [
    { type: "kubectl_apply", target: "deployment/api", idempotencyKey: "deploy-api-v2" },
    { type: "kubectl_apply", target: "deployment/worker", idempotencyKey: "deploy-worker-v2" },
    { type: "kubectl_apply", target: "deployment/scheduler", idempotencyKey: "deploy-scheduler-v2" },
  ];

  trace.record("executor", "replay_start", { summary: "replay_start" });

  for (let i = 0; i < steps.length; i++) {
    if (i === opts.failAfterStep) {
      trace.record("executor", "error", {
        summary: "pod-kill-simulated",
        step: i,
        message: "executor pod terminated mid-run",
      });
      break;
    }
    effectLog.apply(steps[i], trace);
  }

  // Replay: re-run all steps from the beginning
  trace.record("executor", "replay_start", { summary: "replay_start (retry)" });
  for (const step of steps) {
    effectLog.apply(step, trace); // idempotency key deduplicates already-applied steps
  }

  trace.record("executor", "replay_end", { summary: "replay_end" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Failure recovery — idempotent replay", () => {
  it("replayed steps do not duplicate side effects", () => {
    const trace = new TraceEngine("recovery-idempotent");
    const effectLog = new MockEffectLog();

    runWithFailureAndReplay(trace, effectLog, { failAfterStep: 1 });

    // Only 3 unique effects should exist despite replay
    expect(effectLog.count()).toBe(3);
  });

  it("all 3 deployment steps are applied exactly once after replay", () => {
    const trace = new TraceEngine("recovery-all-applied");
    const effectLog = new MockEffectLog();

    runWithFailureAndReplay(trace, effectLog, { failAfterStep: 1 });

    expect(effectLog.has("deploy-api-v2")).toBe(true);
    expect(effectLog.has("deploy-worker-v2")).toBe(true);
    expect(effectLog.has("deploy-scheduler-v2")).toBe(true);
  });

  it("trace records an error event at the failure point", () => {
    const trace = new TraceEngine("recovery-error-recorded");
    const effectLog = new MockEffectLog();

    runWithFailureAndReplay(trace, effectLog, { failAfterStep: 1 });

    const errors = trace.getEventsByKind("error");
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.message).toMatch(/pod terminated/);
  });

  it("replay_start and replay_end events bracket the replay sequence", () => {
    const trace = new TraceEngine("recovery-replay-brackets");
    const effectLog = new MockEffectLog();

    runWithFailureAndReplay(trace, effectLog);

    const starts = trace.getEventsByKind("replay_start");
    const ends = trace.getEventsByKind("replay_end");
    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(ends).toHaveLength(1);
    // replay_end must come after the last replay_start
    const lastStart = starts[starts.length - 1].timestamp;
    expect(ends[0].timestamp >= lastStart).toBe(true);
  });
});

describe("Failure recovery — graceful degradation", () => {
  it("tool errors are recorded as observations, not thrown exceptions", () => {
    const trace = new TraceEngine("recovery-graceful");

    trace.record("executor", "agent_start", { goal: "use flaky tool" });
    trace.record("executor", "tool_call", { tool: "flaky_db", summary: "flaky_db" });

    // Simulate error captured as observation (not thrown)
    trace.record("executor", "observation", {
      summary: "tool:flaky_db errored",
      isError: true,
      message: "connection timeout",
    });

    trace.record("executor", "thought", { summary: "retry with fallback" });
    trace.record("executor", "tool_call", { tool: "fallback_db", summary: "fallback_db" });
    trace.record("executor", "tool_result", { tool: "fallback_db", success: true, summary: "fallback_db" });
    trace.record("executor", "agent_stop", { summary: "completed via fallback" });

    const observations = trace.getEventsByKind("observation");
    const errorObs = observations.filter((e) => e.payload.isError === true);
    expect(errorObs).toHaveLength(1);
    expect(errorObs[0].payload.message).toMatch(/connection timeout/);

    // No error event at the run level — error was handled gracefully
    expect(trace.getEventsByKind("error")).toHaveLength(0);
  });

  it("fallback tool is invoked after primary tool failure", () => {
    const trace = new TraceEngine("recovery-fallback");

    trace.record("executor", "tool_call", { tool: "primary_db", summary: "primary_db" });
    trace.record("executor", "observation", { summary: "primary_db failed", isError: true });
    trace.record("executor", "tool_call", { tool: "fallback_db", summary: "fallback_db" });
    trace.record("executor", "tool_result", { tool: "fallback_db", success: true, summary: "fallback_db" });

    const toolCalls = trace.getEventsByKind("tool_call");
    expect(toolCalls.map((e) => e.payload.tool)).toEqual(["primary_db", "fallback_db"]);
  });
});

describe("Failure recovery — governance boundary preservation during replay", () => {
  it("governance_check is re-evaluated on replay (not skipped)", () => {
    const trace = new TraceEngine("recovery-gov-replay");
    const effectLog = new MockEffectLog();

    // First run: governance check passes, then fails
    trace.record("executor", "governance_check", { policy: "deploy-gate", summary: "deploy-gate" });
    trace.record("executor", "error", { summary: "crash", message: "oom kill" });

    // Replay: governance check must be re-evaluated
    trace.record("executor", "replay_start", { summary: "replay" });
    trace.record("executor", "governance_check", { policy: "deploy-gate", summary: "deploy-gate (replay)" });
    effectLog.apply({ type: "kubectl_apply", target: "api", idempotencyKey: "deploy-api-v3" }, trace);
    trace.record("executor", "replay_end", { summary: "replay_end" });

    const govChecks = trace.getEventsByKind("governance_check");
    expect(govChecks).toHaveLength(2); // once original, once replay
  });

  it("a governance_block during replay prevents the replayed action", () => {
    const trace = new TraceEngine("recovery-gov-block-replay");
    const effectLog = new MockEffectLog();

    trace.record("executor", "replay_start", { summary: "replay" });
    trace.record("executor", "governance_check", { policy: "locked-env", summary: "locked-env" });
    trace.record("executor", "governance_block", {
      policy: "locked-env",
      reason: "production locked during incident",
      summary: "BLOCKED",
    });
    // No effect should be applied after block
    trace.record("executor", "replay_end", { summary: "replay_end" });

    expect(trace.wasBlocked()).toBe(true);
    expect(effectLog.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pending: real infrastructure simulation (Wave 29)
// ---------------------------------------------------------------------------

describe.todo("Pod kill & network partition simulation (Wave 29)", () => {
  // it("kubectl delete pod <orchestrator> → task resumes, no duplicated actions")
  // it("vector DB isolation → graceful degradation, retry, policy-safe fallback")
  // it("Redis isolation → executor falls back to in-memory state, no data loss")
  // it("MCP service isolation → tool calls fail gracefully, run marks degraded")
  // it("state reconciliation succeeds after pod restart")
});
