/**
 * stress-validation/harness/driftMonitor.ts
 *
 * LS-2: Long-Duration Stability Monitor
 *
 * Simulates extended execution windows to detect:
 * - Memory drift accumulation over time
 * - Slow telemetry degradation
 * - Cumulative state divergence
 * - Orphan execution accumulation
 *
 * All time is simulated (no real wall-clock waiting).
 * One "epoch" represents a configurable simulated time window.
 */

import type {
  DriftSample,
  OrphanExecutionRecord,
  LongDurationResult,
} from "./types.js";
import { STRESS_THRESHOLDS } from "./types.js";

// ---------------------------------------------------------------------------
// Deterministic hash simulation
// ---------------------------------------------------------------------------

function deterministicHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Drift simulation model
// ---------------------------------------------------------------------------

/**
 * Simulates memory drift for a given epoch.
 * Drift is modeled as a slow accumulation with occasional spikes.
 *
 * @param epochIndex - The current epoch number (0-based)
 * @param totalEpochs - Total number of epochs in the run
 * @param driftRate - Base drift rate per epoch (0.0 - 1.0)
 * @param seed - Deterministic seed for reproducibility
 */
function simulateDriftForEpoch(
  epochIndex: number,
  totalEpochs: number,
  driftRate: number,
  seed: number
): DriftSample {
  // Cumulative drift grows with epoch index
  const cumulativeDrift = Math.min(driftRate * epochIndex, 1.0);

  // Occasional spike: every ~20 epochs, a brief spike occurs
  const spikeEpoch = epochIndex % 20 === 0 && epochIndex > 0;
  const spikeMagnitude = spikeEpoch ? driftRate * 5 : 0;
  const rawDrift = Math.min(cumulativeDrift + spikeMagnitude, 1.0);

  // Cosine similarity degrades as drift increases
  const cosineSimilarity = Math.max(0, 1.0 - rawDrift * 0.8);

  // State hashes: before and after epoch
  const stateHashBefore = deterministicHash(`epoch-${epochIndex}-before-${seed}`);
  const stateHashAfter = rawDrift > 0.001
    ? deterministicHash(`epoch-${epochIndex}-after-${seed}-drifted`)
    : stateHashBefore;

  return {
    epochMs: epochIndex * 1000,  // 1 second per epoch (simulated)
    driftScore: rawDrift,
    embeddingCosineSimilarity: cosineSimilarity,
    stateHashBefore,
    stateHashAfter,
    driftDetected: rawDrift > STRESS_THRESHOLDS.MEMORY_CONTINUITY_DRIFT_MAX,
  };
}

// ---------------------------------------------------------------------------
// Orphan execution simulation
// ---------------------------------------------------------------------------

/**
 * Simulates orphan execution detection over a run.
 * An execution is orphaned if it has no completion event within the timeout.
 *
 * @param epochIndex - Current epoch
 * @param orphanRate - Fraction of executions that become orphaned (0.0 - 1.0)
 * @param timeoutMs - Orphan detection timeout in simulated ms
 */
function simulateOrphanExecutions(
  epochIndex: number,
  orphanRate: number,
  timeoutMs: number
): OrphanExecutionRecord[] {
  const records: OrphanExecutionRecord[] = [];
  // Each epoch may produce 0-2 orphan candidates
  const candidateCount = Math.floor(orphanRate * 10);
  for (let i = 0; i < candidateCount; i++) {
    const seed = epochIndex * 100 + i;
    const lcg = ((seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    const isOrphaned = lcg < orphanRate;
    const ageMs = isOrphaned ? timeoutMs + 1000 : timeoutMs * 0.5;

    records.push({
      runId: `orphan-run-${epochIndex}-${i}`,
      agentId: `agent-${(epochIndex + i) % 10}`,
      startedAt: new Date(epochIndex * 1000).toISOString(),
      lastSeenAt: new Date(epochIndex * 1000 + ageMs * 0.9).toISOString(),
      ageMs,
      isOrphaned,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Telemetry degradation model
// ---------------------------------------------------------------------------

/**
 * Detects whether telemetry has degraded over the run.
 * Degradation is defined as: the average drift score in the last 10% of
 * epochs is more than 2x the average in the first 10%.
 */
function detectTelemetryDegradation(driftSamples: DriftSample[]): boolean {
  if (driftSamples.length < 20) return false;
  const windowSize = Math.max(1, Math.floor(driftSamples.length * 0.1));
  const firstWindow = driftSamples.slice(0, windowSize);
  const lastWindow = driftSamples.slice(-windowSize);
  const firstAvg = firstWindow.reduce((s, d) => s + d.driftScore, 0) / firstWindow.length;
  const lastAvg = lastWindow.reduce((s, d) => s + d.driftScore, 0) / lastWindow.length;
  return lastAvg > firstAvg * 2 && lastAvg > 0.01;
}

// ---------------------------------------------------------------------------
// Main drift monitor
// ---------------------------------------------------------------------------

export interface DriftMonitorConfig {
  readonly epochCount: number;
  readonly simulatedDurationMs: number;  // total simulated window
  readonly driftRatePerEpoch: number;    // base drift per epoch
  readonly orphanRate: number;           // fraction of executions that orphan
  readonly orphanTimeoutMs: number;      // orphan detection timeout
  readonly seed: number;
}

export class DriftMonitor {
  /**
   * Runs a long-duration stability simulation.
   * All time is simulated — this completes in milliseconds.
   */
  run(config: DriftMonitorConfig): LongDurationResult {
    const driftSamples: DriftSample[] = [];
    const orphanExecutions: OrphanExecutionRecord[] = [];

    for (let epoch = 0; epoch < config.epochCount; epoch++) {
      // Collect drift sample
      driftSamples.push(
        simulateDriftForEpoch(epoch, config.epochCount, config.driftRatePerEpoch, config.seed)
      );

      // Collect orphan executions
      const orphans = simulateOrphanExecutions(epoch, config.orphanRate, config.orphanTimeoutMs);
      orphanExecutions.push(...orphans);
    }

    const maxDriftScore = Math.max(...driftSamples.map((d) => d.driftScore));
    const avgDriftScore = driftSamples.reduce((s, d) => s + d.driftScore, 0) / driftSamples.length;
    const orphanedCount = orphanExecutions.filter((o) => o.isOrphaned).length;
    const orphanRate = orphanedCount / Math.max(orphanExecutions.length, 1);
    const telemetryDegradationDetected = detectTelemetryDegradation(driftSamples);

    // Validate against thresholds
    const violations: string[] = [];
    if (maxDriftScore > STRESS_THRESHOLDS.MEMORY_CONTINUITY_DRIFT_MAX) {
      violations.push(
        `Max drift score ${maxDriftScore.toFixed(4)} exceeds threshold ${STRESS_THRESHOLDS.MEMORY_CONTINUITY_DRIFT_MAX}`
      );
    }
    if (orphanRate > 0.001) {
      violations.push(
        `Orphan execution rate ${(orphanRate * 100).toFixed(2)}% exceeds 0.1% threshold`
      );
    }
    if (telemetryDegradationDetected) {
      violations.push("Telemetry degradation detected: last-window drift is 2x first-window drift");
    }

    return {
      durationMs: config.simulatedDurationMs,
      epochCount: config.epochCount,
      driftSamples,
      orphanExecutions,
      maxDriftScore,
      avgDriftScore,
      orphanRate,
      telemetryDegradationDetected,
      passed: violations.length === 0,
      violations,
    };
  }
}
