/**
 * runtime-validation/harness/types.ts
 *
 * Shared types for the Devonn.AI Runtime Validation Harness.
 * These types model execution traces, DAG nodes, and scenario results.
 * They are intentionally decoupled from production src/ types so the
 * harness can evolve independently of the runtime implementation.
 */

// ---------------------------------------------------------------------------
// Trace & DAG types
// ---------------------------------------------------------------------------

export type TraceEventKind =
  | "agent_start"
  | "agent_stop"
  | "delegation"          // parent agent delegates to child
  | "tool_call"
  | "tool_result"
  | "thought"
  | "observation"
  | "memory_read"
  | "memory_write"
  | "governance_check"    // policy evaluation
  | "governance_block"    // policy hard-deny
  | "governance_escalate" // policy escalation to human review
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
