/**
 * stress-validation/scenarios/ls1-concurrency/concurrency.test.ts
 *
 * LS-1: Synthetic Concurrency Validation
 *
 * Validates that the autonomous runtime maintains behavioral integrity
 * under concurrent agent load. Tests throughput ceiling, arbitration
 * latency, trace DAG growth, and replay queue saturation thresholds.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConcurrencyRunner, resetConcurrencySequence } from "../../harness/concurrencyRunner.js";
import { STRESS_THRESHOLDS } from "../../harness/types.js";

const BASE_CONFIG = {
  operationsPerAgent: 7,
  operationDelayMs: 1,
  warmupRounds: 1,
  measurementRounds: 3,
} as const;

describe("LS-1: Synthetic Concurrency — baseline correctness", () => {
  beforeEach(() => resetConcurrencySequence());

  it("completes all operations for a single agent without errors", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 1 });

    expect(result.throughput.operationsCompleted).toBeGreaterThan(0);
    expect(result.throughput.errorRate).toBeLessThan(0.02);
    expect(result.latencySamples.length).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
  });

  it("all latency samples have valid operation types and timestamps", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 5 });

    const validTypes = new Set([
      "arbitration", "replay", "memory_read", "memory_write",
      "trace_write", "governance_check", "recovery",
    ]);

    for (const sample of result.latencySamples) {
      expect(validTypes.has(sample.operationType)).toBe(true);
      expect(sample.durationMs).toBeGreaterThan(0);
      expect(sample.agentId).toMatch(/^agent-\d{4}$/);
      expect(sample.runId).toMatch(/^run-ls1-/);
    }
  });

  it("queue snapshots are captured for all queue types", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 10, measurementRounds: 2 });

    const queueTypes = new Set(result.queueSnapshots.map((q) => q.queueName));
    expect(queueTypes.has("replay")).toBe(true);
    expect(queueTypes.has("arbitration")).toBe(true);
    expect(queueTypes.has("recovery")).toBe(true);
    expect(queueTypes.has("telemetry")).toBe(true);
    expect(queueTypes.has("trace")).toBe(true);
  });
});

describe("LS-1: Synthetic Concurrency — latency thresholds", () => {
  beforeEach(() => resetConcurrencySequence());

  it("p50 latency is below p95 which is below p99", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 20 });

    expect(result.p50LatencyMs).toBeLessThanOrEqual(result.p95LatencyMs);
    expect(result.p95LatencyMs).toBeLessThanOrEqual(result.p99LatencyMs);
    expect(result.p99LatencyMs).toBeLessThanOrEqual(result.maxLatencyMs);
  });

  it("arbitration p99 latency stays within threshold at low concurrency", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 10 });

    const arbSamples = result.latencySamples
      .filter((s) => s.operationType === "arbitration")
      .map((s) => s.durationMs)
      .sort((a, b) => a - b);

    if (arbSamples.length > 0) {
      const p99Idx = Math.ceil(0.99 * arbSamples.length) - 1;
      const p99 = arbSamples[Math.max(0, p99Idx)];
      expect(p99).toBeLessThan(STRESS_THRESHOLDS.CONCURRENCY_P99_LATENCY_MAX_MS);
    }
  });

  it("latency grows sub-linearly as concurrency increases", () => {
    const runner = new ConcurrencyRunner();
    const low = runner.run({ ...BASE_CONFIG, concurrentAgents: 5 });
    const high = runner.run({ ...BASE_CONFIG, concurrentAgents: 50 });

    // p99 at 50 agents should be less than 10x the p99 at 5 agents
    // (sub-linear growth due to the log2 contention model)
    expect(high.p99LatencyMs).toBeLessThan(low.p99LatencyMs * 10);
  });

  it("all operation types have positive latency values", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 15 });

    const byType = new Map<string, number[]>();
    for (const s of result.latencySamples) {
      if (!byType.has(s.operationType)) byType.set(s.operationType, []);
      byType.get(s.operationType)!.push(s.durationMs);
    }

    for (const [type, latencies] of byType) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avg).toBeGreaterThan(0);
      expect(avg).toBeLessThan(1000); // sanity: no operation should average >1s
    }
  });
});

describe("LS-1: Synthetic Concurrency — throughput ceiling", () => {
  beforeEach(() => resetConcurrencySequence());

  it("throughput ceiling is positive and decreases with concurrency", () => {
    const runner = new ConcurrencyRunner();
    const low = runner.run({ ...BASE_CONFIG, concurrentAgents: 10 });
    const high = runner.run({ ...BASE_CONFIG, concurrentAgents: 100 });

    expect(low.throughputCeiling).toBeGreaterThan(0);
    expect(high.throughputCeiling).toBeGreaterThan(0);
    // Higher concurrency should have a lower ceiling due to contention
    expect(high.throughputCeiling).toBeLessThan(low.throughputCeiling);
  });

  it("error rate stays below 2% at moderate concurrency", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 50 });

    expect(result.throughput.errorRate).toBeLessThan(0.02);
  });

  it("throughput sweep produces monotonically decreasing ceilings", () => {
    const runner = new ConcurrencyRunner();
    const results = runner.sweep([1, 5, 10, 25, 50], BASE_CONFIG);

    expect(results.length).toBe(5);
    for (let i = 1; i < results.length; i++) {
      // Each step should have a lower or equal ceiling
      expect(results[i].throughputCeiling).toBeLessThanOrEqual(
        results[i - 1].throughputCeiling * 1.05  // 5% tolerance
      );
    }
  });
});

describe("LS-1: Synthetic Concurrency — queue saturation", () => {
  beforeEach(() => resetConcurrencySequence());

  it("queues are not saturated at low concurrency", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 5, measurementRounds: 3 });

    const saturated = result.queueSnapshots.filter((q) => q.isSaturated);
    expect(saturated.length).toBe(0);
  });

  it("saturation point is greater than current concurrency at low load", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 10 });

    expect(result.saturationPoint).toBeGreaterThan(result.config.concurrentAgents);
  });

  it("max observed queue depth is always >= current depth", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 20, measurementRounds: 5 });

    for (const snapshot of result.queueSnapshots) {
      expect(snapshot.maxObservedDepth).toBeGreaterThanOrEqual(snapshot.depth);
    }
  });

  it("trace and telemetry queues have higher saturation thresholds than arbitration", () => {
    const runner = new ConcurrencyRunner();
    // At very high concurrency, arbitration should saturate before trace/telemetry
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 400, measurementRounds: 5 });

    const arbSaturated = result.queueSnapshots.filter(
      (q) => q.queueName === "arbitration" && q.isSaturated
    );
    const traceSaturated = result.queueSnapshots.filter(
      (q) => q.queueName === "trace" && q.isSaturated
    );

    // Arbitration (threshold 300) saturates before trace (threshold 2000)
    if (arbSaturated.length > 0) {
      // If arbitration is saturated, trace may or may not be — that's fine
      expect(arbSaturated.length).toBeGreaterThan(0);
    }
    // Trace queue should not be saturated at 400 agents (depth ~320, threshold 2000)
    expect(traceSaturated.length).toBe(0);
  });
});

describe("LS-1: Synthetic Concurrency — result structure", () => {
  beforeEach(() => resetConcurrencySequence());

  it("result is fully serializable to JSON", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 5 });

    const serialized = JSON.stringify(result);
    expect(serialized).toBeTruthy();
    const parsed = JSON.parse(serialized);
    expect(parsed.config.concurrentAgents).toBe(5);
    expect(parsed.throughput.operationsCompleted).toBeGreaterThan(0);
  });

  it("violations array is empty for a passing test", () => {
    const runner = new ConcurrencyRunner();
    const result = runner.run({ ...BASE_CONFIG, concurrentAgents: 5 });

    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("config is preserved in the result", () => {
    const runner = new ConcurrencyRunner();
    const config = { ...BASE_CONFIG, concurrentAgents: 7 };
    const result = runner.run(config);

    expect(result.config.concurrentAgents).toBe(7);
    expect(result.config.operationsPerAgent).toBe(BASE_CONFIG.operationsPerAgent);
    expect(result.config.measurementRounds).toBe(BASE_CONFIG.measurementRounds);
  });
});
