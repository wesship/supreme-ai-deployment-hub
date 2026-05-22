/**
 * runtime-validation/harness/traceEngine.ts
 *
 * Execution Trace Engine for the Devonn.AI Runtime Validation Harness.
 *
 * Responsibilities:
 *   - Capture every runtime event as a structured TraceEvent
 *   - Build the execution DAG (parent-child causality tree)
 *   - Assign correlation IDs (runId) and span IDs for OpenTelemetry compatibility
 *   - Provide query helpers: getEventsByKind, getAgentLineage, getDelegationChains
 *
 * Design: the engine is a pure in-memory recorder. It has no network calls,
 * no side effects, and no dependencies on production src/ modules. It can be
 * instantiated in any test without setup overhead.
 */

import type {
  TraceEvent,
  TraceEventKind,
  DAGNode,
  ExecutionDAG,
} from "./types";

// ---------------------------------------------------------------------------
// Tiny deterministic ID generator (no external deps)
// ---------------------------------------------------------------------------

let _seq = 0;
function nextId(prefix = "ev"): string {
  _seq += 1;
  return `${prefix}-${Date.now()}-${_seq}`;
}

/** Reset the sequence counter — call in beforeEach to get stable IDs in tests */
export function resetIdSequence(): void {
  _seq = 0;
}

// ---------------------------------------------------------------------------
// TraceEngine
// ---------------------------------------------------------------------------

export class TraceEngine {
  private events: TraceEvent[] = [];
  private startTime: number;
  readonly runId: string;

  /** Current span stack — push on delegation, pop on return */
  private spanStack: string[] = [];

  constructor(runId?: string) {
    this.runId = runId ?? nextId("run");
    this.startTime = Date.now();
    // Root span
    this.spanStack.push(nextId("span"));
  }

  // -------------------------------------------------------------------------
  // Recording API
  // -------------------------------------------------------------------------

  /** Record a new event and return it */
  record(
    agentId: string,
    kind: TraceEventKind,
    payload: Record<string, unknown> = {}
  ): TraceEvent {
    const spanId = this.currentSpanId();
    const parentSpanId = this.parentSpanId();
    const event: TraceEvent = {
      id: nextId("ev"),
      runId: this.runId,
      spanId,
      parentSpanId,
      agentId,
      kind,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Open a new child span — call when an agent delegates to another agent
   * or enters a sub-operation that should appear as a child in the DAG.
   */
  pushSpan(): string {
    const id = nextId("span");
    this.spanStack.push(id);
    return id;
  }

  /** Close the current span — call when the delegated operation completes */
  popSpan(): void {
    if (this.spanStack.length > 1) {
      this.spanStack.pop();
    }
  }

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  /** All recorded events, in insertion order */
  allEvents(): TraceEvent[] {
    return [...this.events];
  }

  /** Filter events by kind */
  getEventsByKind(kind: TraceEventKind): TraceEvent[] {
    return this.events.filter((e) => e.kind === kind);
  }

  /** All events emitted by a specific agent */
  getEventsByAgent(agentId: string): TraceEvent[] {
    return this.events.filter((e) => e.agentId === agentId);
  }

  /**
   * Agent lineage: ordered list of agentIds that participated in the run,
   * in the order they first appeared.
   */
  getAgentLineage(): string[] {
    const seen = new Set<string>();
    const lineage: string[] = [];
    for (const e of this.events) {
      if (!seen.has(e.agentId)) {
        seen.add(e.agentId);
        lineage.push(e.agentId);
      }
    }
    return lineage;
  }

  /**
   * Delegation chains: returns an array of [delegator, delegatee] pairs
   * extracted from "delegation" events.
   */
  getDelegationChains(): Array<{ from: string; to: string; spanId: string }> {
    return this.getEventsByKind("delegation").map((e) => ({
      from: e.agentId,
      to: String(e.payload.targetAgentId ?? "unknown"),
      spanId: e.spanId,
    }));
  }

  /**
   * Governance events: all policy checks, blocks, and escalations.
   */
  getGovernanceEvents(): TraceEvent[] {
    return this.events.filter((e) =>
      ["governance_check", "governance_block", "governance_escalate"].includes(e.kind)
    );
  }

  /**
   * Check whether any governance_block event was emitted.
   * Useful for asserting that unauthorized actions were denied.
   */
  wasBlocked(): boolean {
    return this.getEventsByKind("governance_block").length > 0;
  }

  /**
   * Check whether any governance_escalate event was emitted.
   */
  wasEscalated(): boolean {
    return this.getEventsByKind("governance_escalate").length > 0;
  }

  // -------------------------------------------------------------------------
  // DAG construction
  // -------------------------------------------------------------------------

  /**
   * Build the execution DAG from recorded events.
   * Events are grouped by spanId; parent-child relationships are derived
   * from the parentSpanId chain.
   */
  buildDAG(): ExecutionDAG {
    const durationMs = Date.now() - this.startTime;

    // Build a map of spanId → events
    const spanMap = new Map<string, TraceEvent[]>();
    for (const e of this.events) {
      if (!spanMap.has(e.spanId)) spanMap.set(e.spanId, []);
      spanMap.get(e.spanId)!.push(e);
    }

    // Build a map of spanId → parentSpanId
    const parentMap = new Map<string, string | undefined>();
    for (const e of this.events) {
      if (!parentMap.has(e.spanId)) {
        parentMap.set(e.spanId, e.parentSpanId);
      }
    }

    // Find root span (no parent or parent not in map)
    const allSpans = [...spanMap.keys()];
    const rootSpan =
      allSpans.find((s) => !parentMap.get(s)) ?? allSpans[0] ?? "root";

    // Recursively build DAG nodes
    const buildNode = (spanId: string): DAGNode => {
      const spanEvents = spanMap.get(spanId) ?? [];
      const firstEvent = spanEvents[0];
      const childSpans = allSpans.filter((s) => parentMap.get(s) === spanId);

      return {
        id: spanId,
        kind: firstEvent?.kind ?? "thought",
        agentId: firstEvent?.agentId ?? "unknown",
        label: spanEvents
          .map((e) => `[${e.kind}] ${String(e.payload.summary ?? e.payload.tool ?? e.kind)}`)
          .join(" → "),
        children: childSpans.map(buildNode),
      };
    };

    return {
      runId: this.runId,
      root: buildNode(rootSpan),
      events: [...this.events],
      durationMs,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private currentSpanId(): string {
    return this.spanStack[this.spanStack.length - 1] ?? "root";
  }

  private parentSpanId(): string | undefined {
    return this.spanStack.length > 1
      ? this.spanStack[this.spanStack.length - 2]
      : undefined;
  }
}
