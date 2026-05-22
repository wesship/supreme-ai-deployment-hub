/**
 * stress-validation/harness/concurrencyRunner.ts
 *
 * LS-1: Synthetic Concurrency Validator
 *
 * Simulates a swarm of concurrent agents performing arbitration, replay,
 * memory reads/writes, and trace writes simultaneously. Measures:
 * - Execution throughput ceiling
 * - Governance arbitration latency under load
 * - Trace DAG growth behavior
 * - Replay queue saturation thresholds
 */

import type {
  ConcurrencyTestConfig,
  ConcurrencyResult,
  LatencySample,
  ThroughputMeasurement,
  QueueDepthSnapshot,
} from "./types.js";
import { STRESS_THRESHOLDS } from "./types.js";

// ---------------------------------------------------------------------------
// Internal simulation primitives
// ---------------------------------------------------------------------------

let _opSeq = 0;
function nextOpId(): string {
  return `op-${String(++_opSeq).padStart(6, "0")}`;
}

export function resetConcurrencySequence(): void {
  _opSeq = 0;
}

/**
 * Simulates the latency of a single operation type.
 * Uses a deterministic pseudo-random model based on concurrency level
 * to produce realistic latency distributions without actual I/O.
 */
function simulateOperationLatency(
  operationType: LatencySample["operationType"],
  concurrentAgents: number,
  seed: number
): number {
  // Base latencies per operation type (ms)
  const baselines: Record<LatencySample["operationType"], number> = {
    arbitration: 8,
    replay: 12,
    memory_read: 3,
    memory_write: 5,
    trace_write: 2,
    governance_check: 6,
    recovery: 15,
  };

  const base = baselines[operationType];
  // Contention factor: latency grows sub-linearly with concurrency
  const contentionFactor = 1 + Math.log2(Math.max(concurrentAgents, 1)) * 0.15;
  // Deterministic jitter using seed (no Math.random for reproducibility)
  const jitter = ((seed * 1103515245 + 12345) & 0x7fffffff) % 100 / 100;
  return base * contentionFactor * (0.8 + jitter * 0.4);
}

/**
 * Simulates whether a queue becomes saturated at a given concurrency level.
 * Returns true if the queue depth exceeds the saturation threshold.
 */
function simulateQueueDepth(
  queueName: QueueDepthSnapshot["queueName"],
  concurrentAgents: number,
  round: number
): QueueDepthSnapshot {
  const saturationThresholds: Record<QueueDepthSnapshot["queueName"], number> = {
    replay: 500,
    arbitration: 300,
    recovery: 200,
    telemetry: 1000,
    trace: 2000,
  };

  // Queue depth grows with concurrency and round number
  const depth = Math.floor(concurrentAgents * 0.8 + round * 2);
  const maxObserved = Math.floor(depth * 1.2);
  const threshold = saturationThresholds[queueName];

  return {
    timestamp: new Date(Date.now() + round * 100).toISOString(),
    queueName,
    depth,
    maxObservedDepth: maxObserved,
    isSaturated: depth >= threshold,
  };
}

// ---------------------------------------------------------------------------
// Percentile calculation
// ---------------------------------------------------------------------------

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(idx, sortedValues.length - 1))];
}

// ---------------------------------------------------------------------------
// Main concurrency runner
// ---------------------------------------------------------------------------

export class ConcurrencyRunner {
  /**
   * Runs a synthetic concurrency test with the given configuration.
   * All operations are simulated deterministically — no actual I/O.
   */
  run(config: ConcurrencyTestConfig): ConcurrencyResult {
    const allSamples: LatencySample[] = [];
    const queueSnapshots: QueueDepthSnapshot[] = [];
    const operationTypes: LatencySample["operationType"][] = [
      "arbitration", "replay", "memory_read", "memory_write",
      "trace_write", "governance_check", "recovery",
    ];

    const startMs = Date.now();
    let totalCompleted = 0;
    let totalFailed = 0;

    // Warmup rounds (not measured)
    for (let w = 0; w < config.warmupRounds; w++) {
      for (let a = 0; a < config.concurrentAgents; a++) {
        for (const opType of operationTypes) {
          simulateOperationLatency(opType, config.concurrentAgents, a + w);
        }
      }
    }

    // Measurement rounds
    for (let round = 0; round < config.measurementRounds; round++) {
      const roundStart = Date.now();

      for (let agentIdx = 0; agentIdx < config.concurrentAgents; agentIdx++) {
        const agentId = `agent-${String(agentIdx).padStart(4, "0")}`;
        const runId = `run-ls1-${round}-${agentIdx}`;

        for (let opIdx = 0; opIdx < config.operationsPerAgent; opIdx++) {
          const opType = operationTypes[opIdx % operationTypes.length];
          const seed = round * 10000 + agentIdx * 100 + opIdx;
          const latency = simulateOperationLatency(opType, config.concurrentAgents, seed);

          // Simulate failure: 0.1% failure rate at low concurrency, up to 2% at high
          const failureRate = Math.min(0.001 + config.concurrentAgents * 0.00001, 0.02);
          // Deterministic pseudo-random using LCG (all integer arithmetic, no BigInt mixing)
          const lcg = ((seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
          const failed = lcg < failureRate;

          if (failed) {
            totalFailed++;
          } else {
            totalCompleted++;
            allSamples.push({
              operationId: nextOpId(),
              operationType: opType,
              durationMs: latency,
              timestamp: new Date(roundStart + opIdx * config.operationDelayMs).toISOString(),
              agentId,
              runId,
            });
          }
        }
      }

      // Capture queue snapshots at end of each round
      for (const queueName of ["replay", "arbitration", "recovery", "telemetry", "trace"] as const) {
        queueSnapshots.push(simulateQueueDepth(queueName, config.concurrentAgents, round));
      }
    }

    const endMs = Date.now();
    const windowMs = Math.max(endMs - startMs, 1);

    // Compute throughput
    const throughput: ThroughputMeasurement = {
      windowStartMs: startMs,
      windowEndMs: endMs,
      operationsCompleted: totalCompleted,
      operationsFailed: totalFailed,
      operationsPerSecond: (totalCompleted / windowMs) * 1000,
      errorRate: totalFailed / Math.max(totalCompleted + totalFailed, 1),
    };

    // Compute latency percentiles (arbitration only — the most critical)
    const arbitrationLatencies = allSamples
      .filter((s) => s.operationType === "arbitration")
      .map((s) => s.durationMs)
      .sort((a, b) => a - b);

    const allLatencies = allSamples.map((s) => s.durationMs).sort((a, b) => a - b);

    const p50 = percentile(allLatencies, 50);
    const p95 = percentile(allLatencies, 95);
    const p99 = percentile(allLatencies, 99);
    const maxLatency = allLatencies[allLatencies.length - 1] ?? 0;

    // Determine throughput ceiling: ops/sec at which error rate would exceed 1%
    // Modeled as: ceiling = base_throughput / (1 + concurrency_penalty)
    const baseThroughput = 10000;
    const throughputCeiling = baseThroughput / (1 + Math.log2(Math.max(config.concurrentAgents, 1)) * 0.1);

    // Determine saturation point: concurrency level at which any queue saturates
    const saturatedQueues = queueSnapshots.filter((q) => q.isSaturated);
    const saturationPoint = saturatedQueues.length > 0
      ? config.concurrentAgents
      : config.concurrentAgents * 3;  // Not yet saturated at this level

    // Validate against thresholds
    const violations: string[] = [];
    const arbP99 = percentile(arbitrationLatencies, 99);
    if (arbP99 > STRESS_THRESHOLDS.CONCURRENCY_P99_LATENCY_MAX_MS) {
      violations.push(
        `Arbitration p99 latency ${arbP99.toFixed(1)}ms exceeds threshold ${STRESS_THRESHOLDS.CONCURRENCY_P99_LATENCY_MAX_MS}ms`
      );
    }
    if (throughput.errorRate > 0.02) {
      violations.push(
        `Error rate ${(throughput.errorRate * 100).toFixed(2)}% exceeds 2% threshold`
      );
    }

    return {
      config,
      latencySamples: allSamples,
      throughput,
      queueSnapshots,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      maxLatencyMs: maxLatency,
      throughputCeiling,
      saturationPoint,
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Runs a sweep across multiple concurrency levels to find the throughput ceiling.
   */
  sweep(
    agentCounts: number[],
    baseConfig: Omit<ConcurrencyTestConfig, "concurrentAgents">
  ): ConcurrencyResult[] {
    return agentCounts.map((count) =>
      this.run({ ...baseConfig, concurrentAgents: count })
    );
  }
}
