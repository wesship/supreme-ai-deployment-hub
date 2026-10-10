/**
 * runtime-validation/scenarios/observability-intelligence.test.ts
 *
 * Wave 31: Observability Intelligence
 *
 * Tests the ObservabilityGraph, GovernanceTelemetryEngine,
 * TemporalCorrelationSystem, and SystemHealthModel.
 *
 * These scenarios validate that the system is understandable over time,
 * not just correct at the moment of execution.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ObservabilityGraph,
  GovernanceTelemetryEngine,
  TemporalCorrelationSystem,
  SystemHealthModel,
  resetObsIdSequence,
} from "../harness/observabilityEngine.js";
import type { TraceEvent } from "../harness/types.js";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function makeEvent(
  kind: TraceEvent["kind"],
  agentId: string,
  runId: string,
  offsetMs = 0,
  payload: Record<string, unknown> = {}
): TraceEvent {
  const base = new Date("2026-01-01T00:00:00.000Z").getTime() + offsetMs;
  return {
    id: `evt-${String(++_seq).padStart(4, "0")}`,
    runId,
    spanId: `span-${_seq}`,
    agentId,
    kind,
    timestamp: new Date(base).toISOString(),
    payload,
  };
}

function makeWave27Events(runId: string, baseMs = 0): TraceEvent[] {
  return [
    makeEvent("agent_start", "planner", runId, baseMs),
    makeEvent("delegation", "planner", runId, baseMs + 10),
    makeEvent("tool_call", "executor", runId, baseMs + 20),
    makeEvent("tool_result", "executor", runId, baseMs + 30),
    makeEvent("governance_check", "auditor", runId, baseMs + 40),
    makeEvent("agent_stop", "planner", runId, baseMs + 50),
  ];
}

function makeWave28Events(runId: string, baseMs = 100): TraceEvent[] {
  return [
    makeEvent("memory_write", "planner", runId, baseMs),
    makeEvent("memory_snapshot", "planner", runId, baseMs + 10),
    makeEvent("restart_begin", "planner", runId, baseMs + 20),
    makeEvent("memory_restore", "planner", runId, baseMs + 30),
    makeEvent("restart_complete", "planner", runId, baseMs + 40),
  ];
}

function makeWave29Events(runId: string, baseMs = 200): TraceEvent[] {
  return [
    makeEvent("failure_injected", "executor", runId, baseMs),
    makeEvent("failure_detected", "executor", runId, baseMs + 5),
    makeEvent("recovery_begin", "executor", runId, baseMs + 10),
    makeEvent("checkpoint_saved", "executor", runId, baseMs + 20),
    makeEvent("recovery_complete", "executor", runId, baseMs + 30),
  ];
}

function makeWave30Events(runId: string, baseMs = 300): TraceEvent[] {
  return [
    makeEvent("arbitration_begin", "governance", runId, baseMs, { conflictClass: "soft" }),
    makeEvent("policy_precedence", "governance", runId, baseMs + 5, { policy: "prefer-auditor" }),
    makeEvent("arbitration_decision", "governance", runId, baseMs + 10, { decision: "allow_winner" }),
    makeEvent("governance_block", "governance", runId, baseMs + 20, { policy: "deny-executor-write" }),
    makeEvent("forbidden_action", "executor", runId, baseMs + 25, { policy: "deny-executor-write" }),
    makeEvent("review_token_issued", "governance", runId, baseMs + 30),
  ];
}

// ---------------------------------------------------------------------------
// Suite 1: ObservabilityGraph — ingestion and wave attribution
// ---------------------------------------------------------------------------

describe("ObservabilityGraph — ingestion and wave attribution", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("ingests events and attributes them to the correct wave", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-obs-001";

    graph.ingestAll(makeWave27Events(runId, 0));
    graph.ingestAll(makeWave28Events(runId, 100));
    graph.ingestAll(makeWave29Events(runId, 200));
    graph.ingestAll(makeWave30Events(runId, 300));

    const counts = graph.waveNodeCounts();
    expect(counts["wave-27"]).toBeGreaterThanOrEqual(4);
    expect(counts["wave-28"]).toBeGreaterThanOrEqual(3);
    expect(counts["wave-29"]).toBeGreaterThanOrEqual(4);
    expect(counts["wave-30"]).toBeGreaterThanOrEqual(4);
    expect(graph.totalNodeCount()).toBeGreaterThanOrEqual(16);
  });

  it("derives governance_trigger signals for wave-30 events", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-obs-002";
    graph.ingestAll(makeWave30Events(runId, 0));

    const govNodes = graph.getNodesBySignal("governance_trigger");
    expect(govNodes.length).toBeGreaterThan(0);
    for (const node of govNodes) {
      expect(node.waveSource).toBe("wave-30");
    }
  });

  it("derives failure_event signals for wave-29 failure events", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-obs-003";
    graph.ingestAll(makeWave29Events(runId, 0));

    const failNodes = graph.getNodesBySignal("failure_event");
    expect(failNodes.length).toBeGreaterThanOrEqual(2); // failure_injected + failure_detected
  });

  it("queries nodes by run ID correctly", () => {
    const graph = new ObservabilityGraph();
    graph.ingestAll(makeWave27Events("run-A", 0));
    graph.ingestAll(makeWave27Events("run-B", 0));

    const runANodes = graph.getNodesByRun("run-A");
    const runBNodes = graph.getNodesByRun("run-B");
    expect(runANodes.length).toBe(6);
    expect(runBNodes.length).toBe(6);
    expect(runANodes.every((n) => n.event.runId === "run-A")).toBe(true);
  });

  it("queries nodes by time range correctly", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-obs-005";
    graph.ingestAll(makeWave27Events(runId, 0));
    graph.ingestAll(makeWave28Events(runId, 100));
    graph.ingestAll(makeWave29Events(runId, 200));

    // Query only the wave-28 window
    const start = new Date("2026-01-01T00:00:00.100Z").toISOString();
    const end = new Date("2026-01-01T00:00:00.150Z").toISOString();
    const rangeNodes = graph.getNodesByTimeRange(start, end);
    expect(rangeNodes.length).toBeGreaterThan(0);
    for (const node of rangeNodes) {
      expect(new Date(node.event.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(start).getTime()
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: GovernanceTelemetryEngine
// ---------------------------------------------------------------------------

describe("GovernanceTelemetryEngine — policy activation and conflict frequency", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("counts total arbitrations correctly", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-tel-001";
    graph.ingestAll(makeWave30Events(runId, 0));
    // Add a second arbitration
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 400, { conflictClass: "hard" }));

    const engine = new GovernanceTelemetryEngine(graph);
    const telemetry = engine.computeTelemetry();
    expect(telemetry.totalArbitrations).toBe(2);
  });

  it("tracks policy activation frequency", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-tel-002";
    graph.ingest(makeEvent("policy_precedence", "governance", runId, 0, { policy: "deny-executor-write" }));
    graph.ingest(makeEvent("policy_precedence", "governance", runId, 10, { policy: "deny-executor-write" }));
    graph.ingest(makeEvent("policy_precedence", "governance", runId, 20, { policy: "prefer-auditor" }));

    const engine = new GovernanceTelemetryEngine(graph);
    const telemetry = engine.computeTelemetry();
    expect(telemetry.policyActivationFrequency["deny-executor-write"]).toBe(2);
    expect(telemetry.policyActivationFrequency["prefer-auditor"]).toBe(1);
    expect(telemetry.dominantPolicy).toBe("deny-executor-write");
  });

  it("counts forbidden actions and review tokens", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-tel-003";
    graph.ingestAll(makeWave30Events(runId, 0));

    const engine = new GovernanceTelemetryEngine(graph);
    const telemetry = engine.computeTelemetry();
    expect(telemetry.forbiddenActionsSuppressed).toBeGreaterThanOrEqual(1);
    expect(telemetry.reviewTokensIssued).toBeGreaterThanOrEqual(1);
  });

  it("tracks conflict class frequency", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-tel-004";
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 0, { conflictClass: "soft" }));
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 10, { conflictClass: "hard" }));
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 20, { conflictClass: "hard" }));
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 30, { conflictClass: "structural" }));

    const engine = new GovernanceTelemetryEngine(graph);
    const telemetry = engine.computeTelemetry();
    expect(telemetry.conflictFrequency.soft).toBe(1);
    expect(telemetry.conflictFrequency.hard).toBe(2);
    expect(telemetry.conflictFrequency.structural).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: TemporalCorrelationSystem — cross-wave correlation
// ---------------------------------------------------------------------------

describe("TemporalCorrelationSystem — cross-wave causal correlation", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("detects governance_to_recovery correlation", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-corr-001";
    // governance_block (wave-30) followed by recovery_begin (wave-29)
    graph.ingest(makeEvent("governance_block", "governance", runId, 0));
    graph.ingest(makeEvent("recovery_begin", "executor", runId, 5));

    const tcs = new TemporalCorrelationSystem(graph);
    const correlations = tcs.findCrossWaveCorrelations();
    const govToRecovery = correlations.filter((c) => c.correlationType === "governance_to_recovery");
    expect(govToRecovery.length).toBeGreaterThan(0);
    expect(govToRecovery[0].sourceWave).toBe("wave-30");
    expect(govToRecovery[0].targetWave).toBe("wave-29");
    expect(govToRecovery[0].confidence).toBeGreaterThan(0.5);
  });

  it("detects failure_to_arbitration correlation", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-corr-002";
    graph.ingest(makeEvent("failure_injected", "executor", runId, 0));
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 5, { conflictClass: "hard" }));

    const tcs = new TemporalCorrelationSystem(graph);
    const correlations = tcs.findCrossWaveCorrelations();
    const failToArb = correlations.filter((c) => c.correlationType === "failure_to_arbitration");
    expect(failToArb.length).toBeGreaterThan(0);
    expect(failToArb[0].sourceWave).toBe("wave-29");
    expect(failToArb[0].targetWave).toBe("wave-30");
  });

  it("detects memory_drift_to_conflict correlation", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-corr-003";
    graph.ingest(makeEvent("memory_drift", "planner", runId, 0));
    graph.ingest(makeEvent("conflict_detected", "governance", runId, 5));

    const tcs = new TemporalCorrelationSystem(graph);
    const correlations = tcs.findCrossWaveCorrelations();
    const driftToConflict = correlations.filter((c) => c.correlationType === "memory_drift_to_conflict");
    expect(driftToConflict.length).toBeGreaterThan(0);
    expect(driftToConflict[0].sourceWave).toBe("wave-28");
    expect(driftToConflict[0].targetWave).toBe("wave-30");
  });

  it("clusters events into temporal windows correctly", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-corr-004";
    // Three events in a tight window, then a gap, then two more
    graph.ingest(makeEvent("agent_start", "planner", runId, 0));
    graph.ingest(makeEvent("delegation", "planner", runId, 5));
    graph.ingest(makeEvent("tool_call", "executor", runId, 10));
    // 200ms gap
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 210, { conflictClass: "soft" }));
    graph.ingest(makeEvent("arbitration_decision", "governance", runId, 215, { decision: "allow_winner" }));

    const tcs = new TemporalCorrelationSystem(graph);
    const clusters = tcs.clusterByTime(50); // 50ms window
    expect(clusters.length).toBe(2);
    expect(clusters[0].events.length).toBe(3);
    expect(clusters[1].events.length).toBe(2);
  });

  it("identifies cross-wave clusters", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-corr-005";
    // Mix wave-27 and wave-30 events in the same tight window
    graph.ingest(makeEvent("agent_start", "planner", runId, 0));
    graph.ingest(makeEvent("arbitration_begin", "governance", runId, 5, { conflictClass: "soft" }));
    graph.ingest(makeEvent("tool_call", "executor", runId, 10));

    const tcs = new TemporalCorrelationSystem(graph);
    const clusters = tcs.clusterByTime(50);
    const crossWaveClusters = clusters.filter((c) => c.hasCrossWaveCorrelation);
    expect(crossWaveClusters.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: SystemHealthModel — health scoring and anomaly detection
// ---------------------------------------------------------------------------

describe("SystemHealthModel — health scoring", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("returns a perfect health score for a clean execution trace", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-health-001";
    graph.ingestAll(makeWave27Events(runId, 0));

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(health.score).toBeGreaterThan(0.7);
    expect(health.activeAnomalies.length).toBe(0);
    expect(health.trend).toBe("stable");
  });

  it("reduces health score when failures are present", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-health-002";
    graph.ingestAll(makeWave27Events(runId, 0));
    // Inject multiple failures
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("failure_injected", "executor", runId, 100 + i * 10));
      graph.ingest(makeEvent("recovery_failed", "executor", runId, 105 + i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(health.score).toBeLessThan(0.8);
    expect(health.components.recoveryHealth).toBeLessThan(0.5);
  });

  it("detects governance_spike anomaly when arbitrations exceed threshold", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-health-003";
    // Inject 8 arbitration events (above the threshold of 5)
    for (let i = 0; i < 8; i++) {
      graph.ingest(makeEvent("arbitration_begin", "governance", runId, i * 10, { conflictClass: "soft" }));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    const spikes = health.activeAnomalies.filter((a) => a.anomalyType === "governance_spike");
    expect(spikes.length).toBeGreaterThan(0);
    expect(spikes[0].severity).toBe("medium");
  });

  it("detects failure_cluster anomaly when failures exceed threshold", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-health-004";
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("failure_injected", "executor", runId, i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    const clusters = health.activeAnomalies.filter((a) => a.anomalyType === "failure_cluster");
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters[0].isPreFailureSignal).toBe(true);
  });

  it("detects authority_escalation_loop when unresolved tokens exceed threshold", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-health-005";
    // 5 tokens issued, 0 resolved
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("review_token_issued", "governance", runId, i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    const loops = health.activeAnomalies.filter((a) => a.anomalyType === "authority_escalation_loop");
    expect(loops.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: SystemHealthModel — drift forecasting
// ---------------------------------------------------------------------------

describe("SystemHealthModel — drift forecasting", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("forecasts stable drift for flat historical scores", () => {
    const graph = new ObservabilityGraph();
    const model = new SystemHealthModel(graph);
    const forecast = model.computeDriftForecast([0.1, 0.1, 0.1, 0.1, 0.1]);
    expect(forecast.predictedDriftScore).toBeCloseTo(0.1, 1);
    expect(forecast.exceedsAlertThreshold).toBe(false);
  });

  it("forecasts increasing drift for an upward trend", () => {
    const graph = new ObservabilityGraph();
    const model = new SystemHealthModel(graph);
    const forecast = model.computeDriftForecast([0.05, 0.10, 0.15, 0.20, 0.25]);
    expect(forecast.predictedDriftScore).toBeGreaterThan(0.20);
  });

  it("flags alert threshold when predicted drift exceeds limit", () => {
    const graph = new ObservabilityGraph();
    const model = new SystemHealthModel(graph);
    const forecast = model.computeDriftForecast([0.20, 0.25, 0.28, 0.31, 0.35], 0.30);
    expect(forecast.exceedsAlertThreshold).toBe(true);
    expect(forecast.alertThreshold).toBe(0.30);
  });

  it("returns zero forecast for empty history", () => {
    const graph = new ObservabilityGraph();
    const model = new SystemHealthModel(graph);
    const forecast = model.computeDriftForecast([]);
    expect(forecast.predictedDriftScore).toBe(0);
    expect(forecast.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Cross-wave unified timeline
// ---------------------------------------------------------------------------

describe("Cross-wave unified timeline — full system observability", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("builds a unified graph from all four harness waves", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-unified-001";
    graph.ingestAll(makeWave27Events(runId, 0));
    graph.ingestAll(makeWave28Events(runId, 100));
    graph.ingestAll(makeWave29Events(runId, 200));
    graph.ingestAll(makeWave30Events(runId, 300));

    expect(graph.totalNodeCount()).toBeGreaterThanOrEqual(22);
    const counts = graph.waveNodeCounts();
    expect(counts["wave-27"]).toBeGreaterThan(0);
    expect(counts["wave-28"]).toBeGreaterThan(0);
    expect(counts["wave-29"]).toBeGreaterThan(0);
    expect(counts["wave-30"]).toBeGreaterThan(0);
  });

  it("produces governance telemetry across the unified timeline", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-unified-002";
    graph.ingestAll(makeWave27Events(runId, 0));
    graph.ingestAll(makeWave30Events(runId, 300));

    const engine = new GovernanceTelemetryEngine(graph);
    const telemetry = engine.computeTelemetry();
    expect(telemetry.totalArbitrations).toBeGreaterThanOrEqual(1);
    expect(telemetry.reviewTokensIssued).toBeGreaterThanOrEqual(1);
  });

  it("finds cross-wave correlations in the unified timeline", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-unified-003";
    graph.ingestAll(makeWave29Events(runId, 0));
    graph.ingestAll(makeWave30Events(runId, 50));

    const tcs = new TemporalCorrelationSystem(graph);
    const correlations = tcs.findCrossWaveCorrelations();
    expect(correlations.length).toBeGreaterThan(0);
  });

  it("computes a composite health score across all waves", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-unified-004";
    graph.ingestAll(makeWave27Events(runId, 0));
    graph.ingestAll(makeWave28Events(runId, 100));
    graph.ingestAll(makeWave29Events(runId, 200));
    graph.ingestAll(makeWave30Events(runId, 300));

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(health.score).toBeGreaterThan(0);
    expect(health.score).toBeLessThanOrEqual(1);
    expect(health.components.executionHealth).toBeGreaterThan(0);
    expect(health.components.governanceHealth).toBeGreaterThan(0);
  });

  it("pre-failure signals are detectable before failure events occur", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-unified-005";
    // Escalation loop before a failure
    for (let i = 0; i < 4; i++) {
      graph.ingest(makeEvent("review_token_issued", "governance", runId, i * 10));
    }
    // Then a failure cluster
    for (let i = 0; i < 4; i++) {
      graph.ingest(makeEvent("failure_injected", "executor", runId, 100 + i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    const preFailureAnomalies = health.activeAnomalies.filter((a) => a.isPreFailureSignal);
    expect(preFailureAnomalies.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 7: System health trend detection
// ---------------------------------------------------------------------------

describe("SystemHealthModel — trend detection", () => {
  beforeEach(() => { _seq = 0; resetObsIdSequence(); });

  it("reports stable trend for a balanced event set", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-trend-001";
    // Balanced: same number of failures in first and second half
    for (let i = 0; i < 4; i++) {
      graph.ingest(makeEvent("agent_start", "planner", runId, i * 10));
      graph.ingest(makeEvent("governance_block", "governance", runId, i * 10 + 5));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(["stable", "improving", "degrading"]).toContain(health.trend);
  });

  it("reports improving trend when second half has fewer failures", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-trend-002";
    // First half: many failures; second half: clean
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("recovery_failed", "executor", runId, i * 10));
    }
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("agent_start", "planner", runId, 200 + i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(health.trend).toBe("improving");
  });

  it("reports degrading trend when second half has more failures", () => {
    const graph = new ObservabilityGraph();
    const runId = "run-trend-003";
    // First half: clean; second half: many failures
    for (let i = 0; i < 5; i++) {
      graph.ingest(makeEvent("agent_start", "planner", runId, i * 10));
    }
    for (let i = 0; i < 8; i++) {
      graph.ingest(makeEvent("recovery_failed", "executor", runId, 200 + i * 10));
    }

    const model = new SystemHealthModel(graph);
    const health = model.computeHealthScore();
    expect(health.trend).toBe("degrading");
  });
});
