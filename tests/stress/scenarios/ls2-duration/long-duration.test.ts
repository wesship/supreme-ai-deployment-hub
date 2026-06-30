/**
 * stress-validation/scenarios/ls2-duration/long-duration.test.ts
 *
 * LS-2: Long-Duration Stability Validation
 *
 * Validates that the autonomous runtime maintains memory continuity,
 * avoids orphan accumulation, and resists telemetry degradation
 * over simulated 24h and 72h execution windows.
 */

import { describe, it, expect } from "vitest";
import { DriftMonitor } from "../../harness/driftMonitor.js";
import { STRESS_THRESHOLDS } from "../../harness/types.js";

// Simulated epoch counts:
// 1 epoch = 1 second simulated
// 24h = 86,400 epochs (too slow for CI; use 1,000 as representative sample)
// 72h = 259,200 epochs (use 3,000 as representative sample)
const EPOCHS_24H = 1000;
const EPOCHS_72H = 3000;
const SIMULATED_24H_MS = 24 * 60 * 60 * 1000;
const SIMULATED_72H_MS = 72 * 60 * 60 * 1000;

describe("LS-2: Long-Duration Stability — zero-drift baseline", () => {
  it("produces zero drift for a perfectly stable execution", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,  // no drift
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 42,
    });

    expect(result.maxDriftScore).toBe(0);
    expect(result.avgDriftScore).toBe(0);
    expect(result.telemetryDegradationDetected).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("all drift samples have cosine similarity of 1.0 at zero drift", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 50,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 7,
    });

    for (const sample of result.driftSamples) {
      expect(sample.embeddingCosineSimilarity).toBeCloseTo(1.0, 5);
      expect(sample.driftDetected).toBe(false);
    }
  });

  it("state hashes are identical before and after at zero drift", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 20,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 99,
    });

    for (const sample of result.driftSamples) {
      expect(sample.stateHashBefore).toBe(sample.stateHashAfter);
    }
  });
});

describe("LS-2: Long-Duration Stability — drift accumulation model", () => {
  it("drift accumulates over epochs at a non-zero drift rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0.0001,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 1,
    });

    // Later epochs should have higher drift than early epochs
    const firstTen = result.driftSamples.slice(1, 11).map((d) => d.driftScore);
    const lastTen = result.driftSamples.slice(-10).map((d) => d.driftScore);
    const firstAvg = firstTen.reduce((a, b) => a + b, 0) / firstTen.length;
    const lastAvg = lastTen.reduce((a, b) => a + b, 0) / lastTen.length;
    expect(lastAvg).toBeGreaterThan(firstAvg);
  });

  it("max drift score is always >= avg drift score", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 200,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0.00005,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 13,
    });

    expect(result.maxDriftScore).toBeGreaterThanOrEqual(result.avgDriftScore);
  });

  it("drift is bounded at 1.0 even at high drift rates", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 500,
      simulatedDurationMs: SIMULATED_72H_MS,
      driftRatePerEpoch: 0.01,  // very high rate
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 55,
    });

    for (const sample of result.driftSamples) {
      expect(sample.driftScore).toBeLessThanOrEqual(1.0);
      expect(sample.driftScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("cosine similarity decreases as drift increases", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0.001,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 77,
    });

    const firstSample = result.driftSamples[1];
    const lastSample = result.driftSamples[result.driftSamples.length - 1];
    // If drift increased, cosine similarity should have decreased
    if (lastSample.driftScore > firstSample.driftScore) {
      expect(lastSample.embeddingCosineSimilarity).toBeLessThanOrEqual(
        firstSample.embeddingCosineSimilarity
      );
    }
  });
});

describe("LS-2: Long-Duration Stability — 24h simulated window", () => {
  it("passes the 24h stability check with zero drift rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: EPOCHS_24H,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 24,
    });

    expect(result.epochCount).toBe(EPOCHS_24H);
    expect(result.durationMs).toBe(SIMULATED_24H_MS);
    expect(result.passed).toBe(true);
    expect(result.maxDriftScore).toBe(0);
  });

  it("detects drift violation at 24h with high drift rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: EPOCHS_24H,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0.0001,  // accumulates to 10% over 1000 epochs
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 24,
    });

    expect(result.maxDriftScore).toBeGreaterThan(STRESS_THRESHOLDS.MEMORY_CONTINUITY_DRIFT_MAX);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe("LS-2: Long-Duration Stability — 72h simulated window", () => {
  it("passes the 72h stability check with zero drift rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: EPOCHS_72H,
      simulatedDurationMs: SIMULATED_72H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 72,
    });

    expect(result.epochCount).toBe(EPOCHS_72H);
    expect(result.passed).toBe(true);
    expect(result.maxDriftScore).toBe(0);
    expect(result.orphanRate).toBe(0);
  });

  it("detects telemetry degradation over 72h with increasing drift", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: EPOCHS_72H,
      simulatedDurationMs: SIMULATED_72H_MS,
      driftRatePerEpoch: 0.00005,  // slow accumulation
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 72,
    });

    // With 3000 epochs at 0.00005/epoch, max drift = 0.15 (> 0.01 threshold)
    expect(result.maxDriftScore).toBeGreaterThan(STRESS_THRESHOLDS.MEMORY_CONTINUITY_DRIFT_MAX);
    expect(result.telemetryDegradationDetected).toBe(true);
  });
});

describe("LS-2: Long-Duration Stability — orphan execution detection", () => {
  it("produces zero orphans at zero orphan rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 42,
    });

    expect(result.orphanRate).toBe(0);
    expect(result.orphanExecutions.filter((o) => o.isOrphaned).length).toBe(0);
  });

  it("detects orphans at non-zero orphan rate", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0.5,  // 50% orphan rate
      orphanTimeoutMs: 30000,
      seed: 42,
    });

    expect(result.orphanExecutions.length).toBeGreaterThan(0);
    const orphaned = result.orphanExecutions.filter((o) => o.isOrphaned);
    expect(orphaned.length).toBeGreaterThan(0);
    expect(result.orphanRate).toBeGreaterThan(0);
  });

  it("orphaned executions have age greater than the timeout", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 50,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0.8,
      orphanTimeoutMs: 30000,
      seed: 13,
    });

    for (const orphan of result.orphanExecutions.filter((o) => o.isOrphaned)) {
      expect(orphan.ageMs).toBeGreaterThan(30000);
    }
  });

  it("flags violation when orphan rate exceeds 0.1%", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 100,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0.5,
      orphanTimeoutMs: 30000,
      seed: 42,
    });

    expect(result.passed).toBe(false);
    const orphanViolation = result.violations.find((v) => v.includes("Orphan"));
    expect(orphanViolation).toBeTruthy();
  });
});

describe("LS-2: Long-Duration Stability — result structure", () => {
  it("result is fully serializable to JSON", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 20,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 1,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toBeTruthy();
    const parsed = JSON.parse(serialized);
    expect(parsed.epochCount).toBe(20);
    expect(Array.isArray(parsed.driftSamples)).toBe(true);
  });

  it("epoch count matches the number of drift samples", () => {
    const monitor = new DriftMonitor();
    const result = monitor.run({
      epochCount: 50,
      simulatedDurationMs: SIMULATED_24H_MS,
      driftRatePerEpoch: 0,
      orphanRate: 0,
      orphanTimeoutMs: 30000,
      seed: 5,
    });

    expect(result.driftSamples.length).toBe(50);
  });
});
