/**
 * runtime-validation/harness/types.ts
 *
 * Shared types for the Devonn.AI Runtime Validation Harness.
 * These types model execution traces, DAG nodes, scenario results,
 * Wave 28 memory continuity structures, and Wave 29 failure recovery
 * and replay integrity structures.
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
  // Wave 29: failure simulation events
  | "failure_injected"     // a failure was deliberately injected into the execution
  | "failure_detected"     // the system detected a failure condition
  | "recovery_begin"       // recovery procedure initiated
  | "recovery_complete"    // recovery procedure completed successfully
  | "recovery_failed"      // recovery procedure could not complete
  | "checkpoint_saved"     // execution checkpoint persisted for replay
  | "checkpoint_loaded"    // execution checkpoint loaded for replay
  | "replay_step"          // a single step being replayed from checkpoint
  | "idempotency_check"    // verifying a step is safe to replay
  | "idempotency_violation"// a step was replayed but produced different output
  | "network_partition"    // simulated network partition injected
  | "network_restored"     // simulated network partition resolved
  | "causal_link"          // explicit causal dependency between two events
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

// ---------------------------------------------------------------------------
// Wave 29: Failure simulation types
// ---------------------------------------------------------------------------

/**
 * Describes a failure mode that can be injected into an execution scenario.
 * The harness uses these to simulate crash, network, and resource failures
 * without requiring a live infrastructure.
 */
export type FailureMode =
  | "process_crash"        // agent process terminated abruptly
  | "network_partition"    // agent cannot reach external services
  | "memory_corruption"    // memory store returns corrupted/stale data
  | "tool_timeout"         // a tool call exceeds its deadline
  | "governance_deadlock"  // two governance policies conflict and block progress
  | "partial_write"        // memory write interrupted mid-operation
  | "replay_corruption";   // checkpoint data is partially corrupted

export interface FailureSpec {
  /** Unique ID for this failure injection */
  failureId: string;
  mode: FailureMode;
  /** The agent or component targeted by this failure */
  targetAgent: string;
  /**
   * The step index at which the failure should be injected.
   * 0 = before any steps; -1 = at the last step.
   */
  injectAtStep: number;
  /** Human-readable description of what this failure simulates */
  description: string;
  /** Whether the system is expected to recover from this failure */
  expectedRecoverable: boolean;
}

export interface FailureInjectionResult {
  failureId: string;
  mode: FailureMode;
  injectedAt: string;  // ISO-8601 timestamp
  detectedAt?: string; // ISO-8601 timestamp when system detected the failure
  /** Whether the system successfully recovered */
  recovered: boolean;
  /** Steps taken during recovery */
  recoverySteps: string[];
  /** The trace events emitted during the failure and recovery window */
  failureWindow: TraceEvent[];
}

// ---------------------------------------------------------------------------
// Wave 29: Execution checkpoint types
// ---------------------------------------------------------------------------

/**
 * A checkpoint captures the full execution state at a specific step,
 * enabling deterministic replay from that point.
 */
export interface ExecutionCheckpoint {
  checkpointId: string;
  runId: string;
  spanId: string;
  /** The step index at which this checkpoint was saved */
  stepIndex: number;
  capturedAt: string;
  agentId: string;
  /** All trace events up to and including this checkpoint */
  traceHistory: TraceEvent[];
  /** Memory state at checkpoint time */
  memoryState: Record<string, string>;
  /** Governance state at checkpoint time */
  governanceState: GovernanceSnapshot;
  /** Whether this checkpoint was created before a failure injection */
  preFailure: boolean;
}

// ---------------------------------------------------------------------------
// Wave 29: Replay idempotency types
// ---------------------------------------------------------------------------

/**
 * The result of replaying a step from a checkpoint.
 * Idempotent steps must produce identical outputs on replay.
 */
export interface ReplayStepResult {
  stepIndex: number;
  eventKind: TraceEventKind;
  agentId: string;
  /** Output produced during the original execution */
  originalOutput: Record<string, unknown>;
  /** Output produced during the replay */
  replayOutput: Record<string, unknown>;
  /** Whether the outputs are identical */
  isIdempotent: boolean;
  /** Specific fields that diverged between original and replay */
  divergedFields: string[];
}

export interface ReplayIntegrityReport {
  checkpointId: string;
  runId: string;
  totalStepsReplayed: number;
  idempotentSteps: number;
  nonIdempotentSteps: number;
  /** Step results for any steps that failed idempotency */
  violations: ReplayStepResult[];
  /** Overall pass/fail */
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Wave 29: Causal graph types
// ---------------------------------------------------------------------------

/**
 * A causal link records an explicit "A caused B" relationship between
 * two trace events. The causal graph is built by traversing these links.
 */
export interface CausalLink {
  causeEventId: string;
  effectEventId: string;
  /** Human-readable description of the causal relationship */
  reason: string;
}

/**
 * The causal graph for a single run, derived from trace events and
 * explicit causal links. Used to verify that failure injection does not
 * corrupt the causal chain (i.e., effects still trace back to root causes).
 */
export interface CausalGraph {
  runId: string;
  nodes: Map<string, TraceEvent>;
  links: CausalLink[];
  /** Root event IDs (events with no incoming causal links) */
  roots: string[];
}

export interface CausalIntegrityResult {
  runId: string;
  /** Whether every non-root event has at least one causal predecessor */
  allEventsHaveCause: boolean;
  /** Whether the graph is acyclic (no causal loops) */
  isAcyclic: boolean;
  /** Event IDs that are unreachable from any root */
  orphanedEvents: string[];
  /** Event IDs that participate in a causal cycle */
  cyclicEvents: string[];
  passed: boolean;
}
