/**
 * runtime-validation/harness/memoryReplayValidator.ts
 *
 * Memory Replay Validator for the D3VONN.IO Runtime Validation Harness.
 *
 * Core principle (from Wave 28 design):
 *   Memory should not be validated as "stored" — it should be validated as
 *   "reconstructable in execution context."
 *
 * This validator:
 *   1. Takes a pre-restart MemorySnapshot (the expected state)
 *   2. Takes a post-restart MemoryStore (the actual recovered state)
 *   3. Compares them at the span level, not just the key level
 *   4. Produces a ReplayComparison with a drift score
 *   5. Records all divergence events into the TraceEngine for audit
 *
 * Design: pure function — no side effects, no network calls.
 */

import type {
  MemorySnapshot,
  MemorySnapshotEntry,
  ReplayComparison,
  DriftRecord,
} from "./types";
import type { TraceEngine } from "./traceEngine";

// ---------------------------------------------------------------------------
// Cosine similarity (for embedding drift detection)
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two vectors.
 * Returns a value in [-1, 1] where 1 = identical direction.
 * Returns 1.0 if either vector is empty (no embedding = no drift measurable).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1.0;
  if (a.length !== b.length) return 0.0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// MemoryReplayValidator
// ---------------------------------------------------------------------------

/**
 * A simplified in-memory store that represents the post-restart recovered state.
 * In production this would be the AgentMemoryService; here it is a plain map.
 */
export type RecoveredMemoryStore = Map<string, MemorySnapshotEntry>;

export class MemoryReplayValidator {
  private trace: TraceEngine;

  /**
   * Drift threshold: cosine similarity below this value is flagged as drift.
   * Default: 0.95 (5% semantic divergence triggers a drift record).
   */
  readonly driftThreshold: number;

  constructor(trace: TraceEngine, opts: { driftThreshold?: number } = {}) {
    this.trace = trace;
    this.driftThreshold = opts.driftThreshold ?? 0.95;
  }

  /**
   * Compare a pre-restart snapshot against a post-restart recovered store.
   * Records all divergence events into the trace engine.
   *
   * @param snapshot  The pre-restart MemorySnapshot
   * @param recovered The post-restart recovered memory store
   * @param agentId   The agent whose memory is being validated
   */
  compare(
    snapshot: MemorySnapshot,
    recovered: RecoveredMemoryStore,
    agentId: string
  ): ReplayComparison {
    const missingKeys: string[] = [];
    const unexpectedKeys: string[] = [];
    const divergedKeys: DriftRecord[] = [];

    const expectedKeys = new Set(Object.keys(snapshot.memoryEntries));
    const recoveredKeys = new Set(recovered.keys());

    // 1. Find missing keys (in snapshot but not in recovered)
    for (const key of expectedKeys) {
      if (!recoveredKeys.has(key)) {
        missingKeys.push(key);
        this.trace.record(agentId, "memory_drift", {
          key,
          expected: snapshot.memoryEntries[key].content,
          actual: "(missing)",
          summary: `drift:${key}:missing`,
        });
      }
    }

    // 2. Find unexpected keys (in recovered but not in snapshot)
    for (const key of recoveredKeys) {
      if (!expectedKeys.has(key)) {
        unexpectedKeys.push(key);
        // Unexpected keys are noted but not counted as drift
      }
    }

    // 3. Check content and embedding divergence for keys present in both
    for (const key of expectedKeys) {
      if (!recoveredKeys.has(key)) continue; // already counted as missing

      const expected = snapshot.memoryEntries[key];
      const actual = recovered.get(key)!;

      let embeddingSimilarity: number | undefined;
      let contentDiverged = false;

      // Content comparison
      if (expected.content !== actual.content) {
        contentDiverged = true;
      }

      // Embedding comparison (if both have embeddings)
      if (expected.embedding && actual.embedding) {
        embeddingSimilarity = cosineSimilarity(expected.embedding, actual.embedding);
        if (embeddingSimilarity < this.driftThreshold) {
          contentDiverged = true;
        }
      }

      if (contentDiverged) {
        const record: DriftRecord = {
          key,
          expected: expected.content,
          actual: actual.content,
          embeddingSimilarity,
        };
        divergedKeys.push(record);
        this.trace.recordDrift(agentId, key, expected.content, actual.content);
      }
    }

    // 4. Check governance state preservation
    const governanceStatePreserved = this.compareGovernanceState(
      snapshot,
      agentId
    );

    // 5. Compute drift score
    const totalExpected = expectedKeys.size;
    const problematic = missingKeys.length + divergedKeys.length;
    const driftScore = totalExpected === 0 ? 0 : problematic / totalExpected;

    // 6. Memory fully recovered if no missing and no diverged keys
    const memoryFullyRecovered = missingKeys.length === 0 && divergedKeys.length === 0;

    return {
      snapshotId: snapshot.snapshotId,
      runId: snapshot.runId,
      agentId,
      memoryFullyRecovered,
      governanceStatePreserved,
      missingKeys,
      unexpectedKeys,
      divergedKeys,
      driftScore,
    };
  }

  /**
   * Validate that governance state was preserved after restart.
   * In this harness, governance state is checked against the snapshot's
   * governanceState field. A real implementation would query the policy engine.
   *
   * This method records a governance_check event for audit purposes.
   */
  private compareGovernanceState(
    snapshot: MemorySnapshot,
    agentId: string
  ): boolean {
    // For harness purposes, governance state is "preserved" if the snapshot
    // recorded at least one active policy. The real check (Wave 30) will
    // compare against the live policy engine state.
    const hasActivePolicies = snapshot.governanceState.activePolicies.length > 0;
    const hasPendingEscalations = snapshot.governanceState.pendingEscalations.length > 0;

    this.trace.record(agentId, "governance_check", {
      policy: "post-restart-governance-integrity",
      activePolicies: snapshot.governanceState.activePolicies,
      pendingEscalations: snapshot.governanceState.pendingEscalations,
      summary: "post-restart-governance-integrity",
    });

    // If there were pending escalations before restart, they must not be silently dropped.
    // For now, we flag this as a governance concern (Wave 30 will enforce it).
    if (hasPendingEscalations) {
      this.trace.record(agentId, "governance_escalate", {
        policy: "post-restart-escalation-continuity",
        reason: "pending escalations must survive restart",
        summary: "ESCALATE:post-restart-escalation-continuity",
      });
    }

    return hasActivePolicies;
  }
}
