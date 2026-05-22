/**
 * runtime-validation/harness/types.ts
 *
 * Shared types for the Devonn.AI Runtime Validation Harness.
 * These types model execution traces, DAG nodes, scenario results,
 * and Wave 28 memory continuity structures.
 * They are intentionally decoupled from production src/ types so the
 * harness can evolve independently of the runtime implementation.
 */

// ---------------------------------------------------------------------------
// Trace & DAG types
// ---------------------------------------------------------------------------

export type TraceEventKind =
  | "agent_start"
  | "agent_stop"
  | "delegation"           // parent agent delegates to child
  | "tool_call"
  | "tool_result"
  | "thought"
  | "observation"
  | "memory_read"
  | "memory_write"
  | "memory_snapshot"      // Wave 28: point-in-time memory state capture
  | "memory_restore"       // Wave 28: memory restored from snapshot
  | "memory_drift"         // Wave 28: divergence detected between expected and actual state
  | "restart_begin"        // Wave 28: simulated system restart initiated
  | "restart_complete"     // Wave 28: system resumed after restart
  | "governance_check"     // policy evaluation
  | "governance_block"     // policy hard-deny
  | "governance_escalate"  // policy escalation to human review
  | "replay_start"
  | "replay_end"
  | "error";

export interface TraceEvent {
  /** Globally unique event ID (UUID v4) */
  id: string;
  /** Run-level correlation ID — all events in one scenario share this */
  runId: string;
  /** Span ID for parent-child causality (OpenTelemetry-compatible) */
  spanId: string;
  /** Parent span ID — undefined for root events */
  parentSpanId?: string;
  /** The agent that emitted this event */
  agentId: string;
  kind: TraceEventKind;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Arbitrary payload — tool name, policy name, memory key, etc. */
  payload: Record<string, unknown>;
}

/** A node in the execution DAG */
export interface DAGNode {
  id: string;           // same as TraceEvent.id
  kind: TraceEventKind;
  agentId: string;
  label: string;        // human-readable summary
  children: DAGNode[];
}

/** The full execution DAG for one scenario run */
export interface ExecutionDAG {
  runId: string;
  root: DAGNode;
  events: TraceEvent[];
  /** Wall-clock duration in milliseconds */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Scenario result types
// ---------------------------------------------------------------------------

export type ScenarioStatus = "passed" | "failed" | "skipped";

export interface ScenarioAssertion {
  description: string;
  passed: boolean;
  detail?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  status: ScenarioStatus;
  dag: ExecutionDAG;
  assertions: ScenarioAssertion[];
  /** Error message if status === "failed" */
  error?: string;
  /** ISO-8601 timestamp */
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Wave 28: Memory snapshot & replay types
// ---------------------------------------------------------------------------

/**
 * A point-in-time snapshot of the memory store and governance state.
 * Captured at defined execution boundaries (e.g., before a restart,
 * after a task completes, at a delegation handoff).
 */
export interface MemorySnapshot {
  /** Unique snapshot ID — used to reference this snapshot during restore */
  snapshotId: string;
  /** The run and span at which this snapshot was taken */
  runId: string;
  spanId: string;
  /** ISO-8601 timestamp of capture */
  capturedAt: string;
  /** The agent whose memory is being snapshotted */
  agentId: string;
  /** Key-value memory entries at the time of snapshot */
  memoryEntries: Record<string, MemorySnapshotEntry>;
  /** Governance policy state at the time of snapshot */
  governanceState: GovernanceSnapshot;
  /** Execution step index at the time of snapshot */
  stepIndex: number;
}

export interface MemorySnapshotEntry {
  key: string;
  content: string;
  /** Semantic embedding vector (simplified as number array for harness purposes) */
  embedding?: number[];
  writtenAt: string;
  expiresAt?: string;
}

export interface GovernanceSnapshot {
  /** Active policy names at the time of snapshot */
  activePolicies: string[];
  /** Capability set granted to the agent */
  grantedCapabilities: string[];
  /** Any pending escalations */
  pendingEscalations: string[];
}

// ---------------------------------------------------------------------------
// Wave 28: Replay comparison types
// ---------------------------------------------------------------------------

/**
 * The result of comparing a pre-restart snapshot against a post-restart
 * reconstructed state. Used by the MemoryReplayValidator.
 */
export interface ReplayComparison {
  snapshotId: string;
  runId: string;
  agentId: string;
  /** Whether all memory entries were fully recovered */
  memoryFullyRecovered: boolean;
  /** Whether governance state was preserved */
  governanceStatePreserved: boolean;
  /** Keys that were present in snapshot but missing after restore */
  missingKeys: string[];
  /** Keys that were present after restore but not in snapshot (unexpected) */
  unexpectedKeys: string[];
  /** Keys whose content diverged between snapshot and restored state */
  divergedKeys: DriftRecord[];
  /** Overall drift score: 0.0 (identical) to 1.0 (completely diverged) */
  driftScore: number;
}

export interface DriftRecord {
  key: string;
  expected: string;
  actual: string;
  /** Cosine similarity between expected and actual embeddings (if available) */
  embeddingSimilarity?: number;
}
