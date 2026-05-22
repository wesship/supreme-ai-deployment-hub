/**
 * Canary Production Cutover — Integration Test Suite
 *
 * Validates all six phases of the cutover plan:
 *   Phase 0: Kill-switch layer + blast-radius boundaries
 *   Phase 1: Canary routing layer
 *   Phase 2: Governance monitoring
 *   Phase 3: Circuit breakers + failure containment
 *   Phase 4: Live replay debugger
 *   Phase 5: Cost-per-decision telemetry
 *   Phase 6: Rollback decision engine
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  KillSwitchManager,
  KillSwitchError,
  assertNotPaused,
} from "../../lib/cutover/killswitch/index.js";

import {
  BlastRadiusEnforcer,
  BlastRadiusViolation,
} from "../../lib/cutover/blast-radius/index.js";

import {
  CanaryRouter,
  CANARY_STAGE_CONFIG,
  getIngressAnnotations,
} from "../../lib/cutover/canary/index.js";

import {
  GovernanceMonitor,
} from "../../lib/cutover/governance-monitor/index.js";

import {
  CircuitBreaker,
  CircuitOpenError,
  FailureContainmentController,
} from "../../lib/cutover/circuit-breaker/index.js";

import {
  LiveReplayDebugger,
} from "../../lib/cutover/replay-debugger/index.js";

import {
  CostTelemetryCollector,
} from "../../lib/cutover/cost-telemetry/index.js";

import {
  RollbackDecisionEngine,
} from "../../lib/cutover/rollback-engine/index.js";

// ─── Phase 0: Kill-Switch Layer ──────────────────────────────────────────────

describe("Phase 0 — Kill-Switch Layer", () => {
  let ksm: KillSwitchManager;

  beforeEach(() => {
    ksm = new KillSwitchManager();
  });

  it("returns false when no env var is set and no override exists", () => {
    expect(ksm.isActive("GLOBAL_EXECUTION_PAUSE")).toBe(false);
  });

  it("activates a switch at runtime without redeploy", () => {
    ksm.activate("GLOBAL_EXECUTION_PAUSE");
    expect(ksm.isActive("GLOBAL_EXECUTION_PAUSE")).toBe(true);
  });

  it("deactivates a switch at runtime", () => {
    ksm.activate("REPLAY_FREEZE_MODE");
    ksm.deactivate("REPLAY_FREEZE_MODE");
    expect(ksm.isActive("REPLAY_FREEZE_MODE")).toBe(false);
  });

  it("fires change listeners when a switch is toggled", () => {
    const events: string[] = [];
    ksm.onChange((s) => events.push(`${s.name}:${s.enabled}`));
    ksm.activate("CANARY_ONLY_ROUTING_MODE");
    ksm.deactivate("CANARY_ONLY_ROUTING_MODE");
    expect(events).toEqual([
      "CANARY_ONLY_ROUTING_MODE:true",
      "CANARY_ONLY_ROUTING_MODE:false",
    ]);
  });

  it("snapshot returns all four switches", () => {
    const snap = ksm.snapshot();
    expect(snap).toHaveLength(4);
    expect(snap.map((s) => s.name)).toContain("GOVERNANCE_ENFORCEMENT_LOCK");
  });

  it("assertNotPaused throws KillSwitchError when switch is active", () => {
    ksm.activate("GLOBAL_EXECUTION_PAUSE");
    // We test the guard function by using the singleton — override env for isolation
    process.env["GLOBAL_EXECUTION_PAUSE"] = "true";
    expect(() => assertNotPaused("GLOBAL_EXECUTION_PAUSE")).toThrow(KillSwitchError);
    delete process.env["GLOBAL_EXECUTION_PAUSE"];
  });
});

// ─── Phase 0: Blast-Radius Boundaries ────────────────────────────────────────

describe("Phase 0 — Blast-Radius Boundaries", () => {
  let enforcer: BlastRadiusEnforcer;

  beforeEach(() => {
    enforcer = new BlastRadiusEnforcer();
    enforcer.registerTenant({
      tenantId: "tenant-a",
      maxConcurrentAgents: 2,
      maxMemoryNamespaces: 3,
      maxObservabilityEventsPerSecond: 5,
    });
  });

  it("allows acquiring agent slots up to the limit", () => {
    const slot1 = enforcer.acquireAgentSlot("tenant-a");
    const slot2 = enforcer.acquireAgentSlot("tenant-a");
    expect(slot1.slotId).toBeTruthy();
    expect(slot2.slotId).toBeTruthy();
    slot1.dispose();
    slot2.dispose();
  });

  it("throws BlastRadiusViolation when concurrent agent limit is exceeded", () => {
    enforcer.acquireAgentSlot("tenant-a");
    enforcer.acquireAgentSlot("tenant-a");
    expect(() => enforcer.acquireAgentSlot("tenant-a")).toThrow(BlastRadiusViolation);
  });

  it("releases slot on dispose and allows new acquisition", () => {
    const slot1 = enforcer.acquireAgentSlot("tenant-a");
    enforcer.acquireAgentSlot("tenant-a");
    slot1.dispose();
    // Should now succeed
    expect(() => enforcer.acquireAgentSlot("tenant-a")).not.toThrow();
  });

  it("prevents cross-tenant memory namespace sharing", () => {
    enforcer.registerTenant({ tenantId: "tenant-b", maxConcurrentAgents: 2, maxMemoryNamespaces: 3, maxObservabilityEventsPerSecond: 5 });
    enforcer.registerMemoryNamespace("tenant-a", "ns-shared");
    expect(() => enforcer.registerMemoryNamespace("tenant-b", "ns-shared")).toThrow(BlastRadiusViolation);
  });

  it("rate-limits observability events per tenant", () => {
    for (let i = 0; i < 5; i++) enforcer.recordObservabilityEvent("tenant-a");
    expect(() => enforcer.recordObservabilityEvent("tenant-a")).toThrow(BlastRadiusViolation);
  });
});

// ─── Phase 1: Canary Routing ──────────────────────────────────────────────────

describe("Phase 1 — Canary Routing Layer", () => {
  let router: CanaryRouter;

  beforeEach(() => {
    router = new CanaryRouter();
  });

  it("routes no traffic at stage C0", () => {
    const decision = router.route({ requestId: "r1", tenantId: "t1", riskClass: "low" });
    expect(decision.deploymentMode).toBe("stable");
    expect(decision.routed).toBe(false);
  });

  it("blocks high-risk requests at stage C1", () => {
    router.forceStage("C1");
    const decision = router.route({ requestId: "r1", tenantId: "t1", riskClass: "high" });
    expect(decision.deploymentMode).toBe("stable");
    expect(decision.reason).toContain("not allowed at stage C1");
  });

  it("allows high-risk requests at stage C4", () => {
    router.forceStage("C4");
    // Run many times to ensure at least some route to canary
    const decisions = Array.from({ length: 200 }, (_, i) =>
      router.route({ requestId: `r${i}`, tenantId: "t1", riskClass: "high" })
    );
    const canaryCount = decisions.filter((d) => d.deploymentMode === "canary").length;
    // At 5% traffic, expect roughly 5-15 out of 200 to be canary
    expect(canaryCount).toBeGreaterThan(0);
    expect(canaryCount).toBeLessThan(50);
  });

  it("returns correct ingress annotations for each stage", () => {
    expect(getIngressAnnotations("C0")["nginx.ingress.kubernetes.io/canary"]).toBe("false");
    expect(getIngressAnnotations("C1")["nginx.ingress.kubernetes.io/canary"]).toBe("true");
    expect(getIngressAnnotations("C1")["nginx.ingress.kubernetes.io/canary-weight"]).toBe("5");
  });

  it("throws CanaryAdvanceError when min duration has not elapsed", () => {
    router.forceStage("C1");
    // Immediately try to advance — should fail because minDurationMs > 0
    expect(() => router.advanceStage()).toThrow();
  });
});

// ─── Phase 2: Governance Monitoring ──────────────────────────────────────────

describe("Phase 2 — Governance Monitoring", () => {
  let monitor: GovernanceMonitor;

  beforeEach(() => {
    monitor = new GovernanceMonitor(10_000);
  });

  it("returns neutral classification with no events", () => {
    const metrics = monitor.getMetrics();
    expect(metrics.governanceClassification).toBe("neutral");
    expect(metrics.totalDecisions).toBe(0);
  });

  it("computes correct latency percentiles", () => {
    for (let i = 1; i <= 100; i++) {
      monitor.record({
        conflictId: `c${i}`,
        resolution: "allow",
        latencyMs: i,
        policyCount: 1,
        isRetry: false,
        timestamp: Date.now(),
      });
    }
    const m = monitor.getMetrics();
    expect(m.latencyP50Ms).toBe(50);
    expect(m.latencyP95Ms).toBe(95);
    expect(m.latencyP99Ms).toBe(99);
  });

  it("fires critical alert when p95 latency exceeds 200ms", () => {
    const alerts: string[] = [];
    monitor.onAlert((a) => alerts.push(a.level));

    for (let i = 0; i < 20; i++) {
      monitor.record({
        conflictId: `c${i}`,
        resolution: "allow",
        latencyMs: 250,
        policyCount: 1,
        isRetry: false,
        timestamp: Date.now(),
      });
    }

    expect(alerts).toContain("critical");
  });

  it("classifies governance as slowing when p95 >= 200ms", () => {
    for (let i = 0; i < 20; i++) {
      monitor.record({
        conflictId: `c${i}`,
        resolution: "allow",
        latencyMs: 210,
        policyCount: 1,
        isRetry: false,
        timestamp: Date.now(),
      });
    }
    expect(monitor.getMetrics().governanceClassification).toBe("slowing");
  });

  it("classifies governance as protecting when deny rate > 10%", () => {
    for (let i = 0; i < 10; i++) {
      monitor.record({
        conflictId: `c${i}`,
        resolution: i < 2 ? "deny" : "allow",
        latencyMs: 10,
        policyCount: 1,
        isRetry: false,
        timestamp: Date.now(),
      });
    }
    expect(monitor.getMetrics().governanceClassification).toBe("protecting");
  });
});

// ─── Phase 3: Circuit Breakers ────────────────────────────────────────────────

describe("Phase 3 — Circuit Breakers and Failure Containment", () => {
  it("opens circuit after failure threshold is reached", () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 3, resetTimeoutMs: 10_000, halfOpenSuccessThreshold: 1 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("closed");
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
  });

  it("throws CircuitOpenError when circuit is open", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 10_000, halfOpenSuccessThreshold: 1 });
    cb.recordFailure();
    await expect(cb.execute(async () => "result")).rejects.toThrow(CircuitOpenError);
  });

  it("transitions to half-open after reset timeout", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 1, halfOpenSuccessThreshold: 1 });
    cb.recordFailure();
    await new Promise((r) => setTimeout(r, 5));
    // Should attempt half-open on next execute
    const result = await cb.execute(async () => "ok");
    expect(result).toBe("ok");
    expect(cb.getState()).toBe("closed");
  });

  it("dispatches containment actions when tenant breaker trips", () => {
    const controller = new FailureContainmentController();
    const actions: string[] = [];
    controller.onContainmentAction((a) => actions.push(a.type));

    // Trip the tenant breaker (threshold is 10)
    for (let i = 0; i < 10; i++) {
      controller.recordFailure(`exec-${i}`, "tenant-x");
    }

    expect(actions).toContain("stop_agent_spawning");
    expect(actions).toContain("freeze_memory_writes");
    expect(actions).toContain("isolate_tenant");
  });
});

// ─── Phase 4: Live Replay Debugger ───────────────────────────────────────────

describe("Phase 4 — Live Replay Debugger", () => {
  let debugger_: LiveReplayDebugger;

  beforeEach(() => {
    debugger_ = new LiveReplayDebugger();
  });

  it("records matching events with zero divergence", () => {
    const events = [
      { eventId: "e1", executionId: "ex1", type: "step" as const, payload: { x: 1 }, timestamp: 1000 },
      { eventId: "e2", executionId: "ex1", type: "step" as const, payload: { x: 2 }, timestamp: 2000 },
    ];
    debugger_.registerTrace("ex1", events);
    const session = debugger_.startSession("ex1", "delayed");
    debugger_.feedEvent(session.sessionId, events[0]);
    debugger_.feedEvent(session.sessionId, events[1]);
    const completed = debugger_.completeSession(session.sessionId);
    expect(completed.divergenceScore).toBe(0);
    expect(completed.diffs.every((d) => d.type === "match")).toBe(true);
  });

  it("detects payload divergence", () => {
    const original = { eventId: "e1", executionId: "ex1", type: "step" as const, payload: { x: 1 }, timestamp: 1000 };
    const replayed = { ...original, payload: { x: 999 } };
    debugger_.registerTrace("ex1", [original]);
    const session = debugger_.startSession("ex1", "forensic");
    debugger_.feedEvent(session.sessionId, replayed);
    const completed = debugger_.completeSession(session.sessionId);
    expect(completed.diffs.some((d) => d.type === "diverge")).toBe(true);
    expect(completed.divergenceScore).toBeGreaterThan(0);
  });

  it("detects missing events from replay", () => {
    const events = [
      { eventId: "e1", executionId: "ex1", type: "step" as const, payload: {}, timestamp: 1000 },
      { eventId: "e2", executionId: "ex1", type: "step" as const, payload: {}, timestamp: 2000 },
    ];
    debugger_.registerTrace("ex1", events);
    const session = debugger_.startSession("ex1", "delayed");
    debugger_.feedEvent(session.sessionId, events[0]); // only feed e1, not e2
    const completed = debugger_.completeSession(session.sessionId);
    expect(completed.diffs.some((d) => d.type === "missing" && d.eventId === "e2")).toBe(true);
  });
});

// ─── Phase 5: Cost Telemetry ──────────────────────────────────────────────────

describe("Phase 5 — Cost-Per-Decision Telemetry", () => {
  let collector: CostTelemetryCollector;

  beforeEach(() => {
    collector = new CostTelemetryCollector(60_000);
  });

  it("aggregates cost by category correctly", () => {
    collector.record({ eventId: "ev1", executionId: "ex1", tenantId: "t1", category: "arbitration", costNcu: 100, latencyMs: 10, timestamp: Date.now() });
    collector.record({ eventId: "ev2", executionId: "ex1", tenantId: "t1", category: "execution_step", costNcu: 50, latencyMs: 5, timestamp: Date.now() });
    const summary = collector.getSummary("t1");
    expect(summary.costByCategory.arbitration).toBe(100);
    expect(summary.costByCategory.execution_step).toBe(50);
    expect(summary.totalCostNcu).toBe(150);
  });

  it("computes cost per decision correctly", () => {
    for (let i = 0; i < 4; i++) {
      collector.record({ eventId: `ev${i}`, executionId: "ex1", tenantId: "t1", category: "arbitration", costNcu: 200, latencyMs: 20, timestamp: Date.now() });
    }
    const summary = collector.getSummary("t1");
    expect(summary.costPerDecisionNcu).toBe(200);
  });

  it("flags isCostCritical when cost per decision exceeds threshold", () => {
    collector.record({ eventId: "ev1", executionId: "ex1", tenantId: "t1", category: "arbitration", costNcu: 600, latencyMs: 60, timestamp: Date.now() });
    const summary = collector.getSummary("t1");
    expect(summary.isCostCritical).toBe(true);
  });

  it("returns top expensive executions", () => {
    collector.record({ eventId: "ev1", executionId: "ex-cheap", tenantId: "t1", category: "execution_step", costNcu: 10, latencyMs: 1, timestamp: Date.now() });
    collector.record({ eventId: "ev2", executionId: "ex-expensive", tenantId: "t1", category: "execution_step", costNcu: 1000, latencyMs: 100, timestamp: Date.now() });
    const top = collector.getTopExpensiveExecutions(1);
    expect(top[0].executionId).toBe("ex-expensive");
  });
});

// ─── Phase 6: Rollback Decision Engine ───────────────────────────────────────

describe("Phase 6 — Rollback Decision Engine", () => {
  let engine: RollbackDecisionEngine;

  beforeEach(() => {
    engine = new RollbackDecisionEngine();
  });

  it("returns 'none' when all signals are healthy", () => {
    const decision = engine.evaluate({
      errorRate: 0.01, baselineErrorRate: 0.01,
      governanceInstabilityScore: 0.1,
      replayDivergenceScore: 0.05,
      memoryDriftScore: 0.05,
      circuitBreakerOpen: false,
    });
    expect(decision.decisionType).toBe("none");
  });

  it("recommends manual rollback when error rate is 1.5x baseline", () => {
    const decision = engine.evaluate({
      // 0.20 / 0.10 = 2.0x — above the 1.5x manual threshold but below 3.0x auto threshold
      errorRate: 0.20, baselineErrorRate: 0.10,
      governanceInstabilityScore: 0.1,
      replayDivergenceScore: 0.05,
      memoryDriftScore: 0.05,
      circuitBreakerOpen: false,
    });
    expect(decision.decisionType).toBe("manual_recommended");
  });

  it("triggers automatic rollback when multiple critical signals fire", () => {
    const decision = engine.evaluate({
      errorRate: 0.3, baselineErrorRate: 0.05,
      governanceInstabilityScore: 0.85,
      replayDivergenceScore: 0.6,
      memoryDriftScore: 0.5,
      circuitBreakerOpen: true,
    });
    expect(decision.decisionType).toBe("automatic");
    expect(decision.confidence).toBeGreaterThan(0.5);
    expect(decision.reasons.length).toBeGreaterThan(1);
  });

  it("records decision history", () => {
    engine.evaluate({ errorRate: 0.01, baselineErrorRate: 0.01, governanceInstabilityScore: 0, replayDivergenceScore: 0, memoryDriftScore: 0, circuitBreakerOpen: false });
    engine.evaluate({ errorRate: 0.01, baselineErrorRate: 0.01, governanceInstabilityScore: 0, replayDivergenceScore: 0, memoryDriftScore: 0, circuitBreakerOpen: false });
    expect(engine.getHistory()).toHaveLength(2);
  });
});
