/**
 * runtime-validation/harness/failureSimulator.ts
 *
 * Wave 29: Failure Simulation Harness
 *
 * Provides deterministic failure injection for the runtime validation harness.
 * The FailureSimulator wraps a TraceEngine and intercepts execution at specified
 * step indices to inject failure conditions. It records the full failure window
 * (injection → detection → recovery) as trace events.
 *
 * Design principles:
 * - All failures are synchronous and deterministic (no real I/O)
 * - Failure injection is transparent to the test — the harness records what happened
 * - Recovery is simulated by the test scenario, not by the harness itself
 */

import { TraceEngine } from "./traceEngine";
import type {
  FailureMode,
  FailureSpec,
  FailureInjectionResult,
  ExecutionCheckpoint,
  ReplayStepResult,
  ReplayIntegrityReport,
  CausalLink,
  CausalGraph,
  CausalIntegrityResult,
  TraceEvent,
  GovernanceSnapshot,
} from "./types";

// ---------------------------------------------------------------------------
// FailureSimulator
// ---------------------------------------------------------------------------

export class FailureSimulator {
  private trace: TraceEngine;
  private stepCounter = 0;
  private activeFailures: Map<string, FailureSpec> = new Map();
  private injectionResults: Map<string, FailureInjectionResult> = new Map();

  constructor(trace: TraceEngine) {
    this.trace = trace;
  }

  /** Register a failure to be injected at a specific step */
  registerFailure(spec: FailureSpec): void {
    this.activeFailures.set(spec.failureId, spec);
  }

  /**
   * Advance the step counter. Call this before each logical execution step.
   * If a failure is registered for this step, it is injected automatically.
   * Returns the list of failure IDs that were triggered at this step.
   */
  step(agentId: string): string[] {
    const triggered: string[] = [];
    const currentStep = this.stepCounter++;

    for (const [id, spec] of this.activeFailures) {
      const targetStep =
        spec.injectAtStep === -1
          ? currentStep // -1 means "at the current step whenever called last"
          : spec.injectAtStep;

      if (targetStep === currentStep && spec.targetAgent === agentId) {
        this.injectFailure(spec);
        triggered.push(id);
      }
    }

    return triggered;
  }

  private injectFailure(spec: FailureSpec): void {
    const injectedAt = new Date().toISOString();

    // Record the injection event in the trace
    this.trace.record(spec.targetAgent, "failure_injected", {
      failureId: spec.failureId,
      mode: spec.mode,
      description: spec.description,
      injectAtStep: spec.injectAtStep,
    });

    const result: FailureInjectionResult = {
      failureId: spec.failureId,
      mode: spec.mode,
      injectedAt,
      recovered: false,
      recoverySteps: [],
      failureWindow: [],
    };

    this.injectionResults.set(spec.failureId, result);
  }

  /**
   * Record that the system detected a failure. Call this from the test
   * scenario when the agent logic would detect the failure condition.
   */
  recordDetection(failureId: string, agentId: string): void {
    const result = this.injectionResults.get(failureId);
    if (!result) return;

    const detectedAt = new Date().toISOString();
    result.detectedAt = detectedAt;

    this.trace.record(agentId, "failure_detected", {
      failureId,
      mode: result.mode,
      detectedAt,
    });
  }

  /**
   * Record that recovery has begun. Call this from the test scenario
   * when the agent initiates its recovery procedure.
   */
  recordRecoveryBegin(
    failureId: string,
    agentId: string,
    steps: string[]
  ): void {
    const result = this.injectionResults.get(failureId);
    if (!result) return;

    result.recoverySteps = steps;

    this.trace.record(agentId, "recovery_begin", {
      failureId,
      mode: result.mode,
      plannedSteps: steps,
    });
  }

  /**
   * Record that recovery completed successfully.
   */
  recordRecoveryComplete(failureId: string, agentId: string): void {
    const result = this.injectionResults.get(failureId);
    if (!result) return;

    result.recovered = true;

    this.trace.record(agentId, "recovery_complete", {
      failureId,
      mode: result.mode,
      recoverySteps: result.recoverySteps,
    });
  }

  /**
   * Record that recovery failed (the system could not recover).
   */
  recordRecoveryFailed(failureId: string, agentId: string, reason: string): void {
    const result = this.injectionResults.get(failureId);
    if (!result) return;

    result.recovered = false;

    this.trace.record(agentId, "recovery_failed", {
      failureId,
      mode: result.mode,
      reason,
    });
  }

  /**
   * Get the injection result for a specific failure.
   */
  getResult(failureId: string): FailureInjectionResult | undefined {
    return this.injectionResults.get(failureId);
  }

  /**
   * Get all injection results.
   */
  getAllResults(): FailureInjectionResult[] {
    return Array.from(this.injectionResults.values());
  }

  /** Reset the step counter (call in beforeEach) */
  resetStepCounter(): void {
    this.stepCounter = 0;
  }
}

// ---------------------------------------------------------------------------
// CheckpointManager
// ---------------------------------------------------------------------------

export class CheckpointManager {
  private trace: TraceEngine;
  private checkpoints: Map<string, ExecutionCheckpoint> = new Map();
  private checkpointCounter = 0;

  constructor(trace: TraceEngine) {
    this.trace = trace;
  }

  /**
   * Save an execution checkpoint at the current step.
   * Returns the checkpoint ID.
   */
  save(opts: {
    agentId: string;
    stepIndex: number;
    memoryState: Record<string, string>;
    governanceState: GovernanceSnapshot;
    preFailure?: boolean;
  }): string {
    const checkpointId = `ckpt-${++this.checkpointCounter}`;
    const capturedAt = new Date().toISOString();

    const checkpoint: ExecutionCheckpoint = {
      checkpointId,
      runId: this.trace.runId,
      spanId: this.trace.runId, // span ID is embedded in the most recent event
      stepIndex: opts.stepIndex,
      capturedAt,
      agentId: opts.agentId,
      traceHistory: this.trace.allEvents(),
      memoryState: { ...opts.memoryState },
      governanceState: { ...opts.governanceState },
      preFailure: opts.preFailure ?? false,
    };

    this.checkpoints.set(checkpointId, checkpoint);

    this.trace.record(opts.agentId, "checkpoint_saved", {
      checkpointId,
      stepIndex: opts.stepIndex,
      memoryKeyCount: Object.keys(opts.memoryState).length,
      preFailure: opts.preFailure ?? false,
    });

    return checkpointId;
  }

  /**
   * Load a checkpoint and record the load event in the trace.
   */
  load(checkpointId: string, agentId: string): ExecutionCheckpoint | undefined {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return undefined;

    this.trace.record(agentId, "checkpoint_loaded", {
      checkpointId,
      stepIndex: checkpoint.stepIndex,
      capturedAt: checkpoint.capturedAt,
    });

    return checkpoint;
  }

  /**
   * Get a checkpoint without recording a trace event.
   */
  get(checkpointId: string): ExecutionCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * List all checkpoint IDs in the order they were saved.
   */
  listIds(): string[] {
    return Array.from(this.checkpoints.keys());
  }
}

// ---------------------------------------------------------------------------
// ReplayEngine
// ---------------------------------------------------------------------------

/**
 * Replays execution steps from a checkpoint and verifies idempotency.
 * Each replayed step is compared against the original output.
 * Steps that produce different outputs are flagged as idempotency violations.
 */
export class ReplayEngine {
  private trace: TraceEngine;

  constructor(trace: TraceEngine) {
    this.trace = trace;
  }

  /**
   * Replay a sequence of steps from a checkpoint.
   * Each step is a tuple of [eventKind, agentId, originalOutput, replayOutput].
   * Returns a ReplayIntegrityReport.
   */
  replay(
    checkpointId: string,
    steps: Array<{
      eventKind: TraceEvent["kind"];
      agentId: string;
      originalOutput: Record<string, unknown>;
      replayOutput: Record<string, unknown>;
    }>
  ): ReplayIntegrityReport {
    this.trace.record("replay-engine", "replay_start", {
      checkpointId,
      stepCount: steps.length,
    });

    const results: ReplayStepResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const divergedFields = this.findDivergedFields(
        step.originalOutput,
        step.replayOutput
      );
      const isIdempotent = divergedFields.length === 0;

      const result: ReplayStepResult = {
        stepIndex: i,
        eventKind: step.eventKind,
        agentId: step.agentId,
        originalOutput: step.originalOutput,
        replayOutput: step.replayOutput,
        isIdempotent,
        divergedFields,
      };

      results.push(result);

      this.trace.record(step.agentId, "replay_step", {
        checkpointId,
        stepIndex: i,
        eventKind: step.eventKind,
        isIdempotent,
        divergedFields,
      });

      if (!isIdempotent) {
        this.trace.record(step.agentId, "idempotency_violation", {
          checkpointId,
          stepIndex: i,
          divergedFields,
        });
      } else {
        this.trace.record(step.agentId, "idempotency_check", {
          checkpointId,
          stepIndex: i,
          passed: true,
        });
      }
    }

    const violations = results.filter((r) => !r.isIdempotent);
    const report: ReplayIntegrityReport = {
      checkpointId,
      runId: this.trace.runId,
      totalStepsReplayed: steps.length,
      idempotentSteps: results.filter((r) => r.isIdempotent).length,
      nonIdempotentSteps: violations.length,
      violations,
      passed: violations.length === 0,
    };

    this.trace.record("replay-engine", "replay_end", {
      checkpointId,
      totalSteps: steps.length,
      violations: violations.length,
      passed: report.passed,
    });

    return report;
  }

  private findDivergedFields(
    original: Record<string, unknown>,
    replay: Record<string, unknown>
  ): string[] {
    const allKeys = new Set([
      ...Object.keys(original),
      ...Object.keys(replay),
    ]);
    const diverged: string[] = [];

    for (const key of allKeys) {
      if (JSON.stringify(original[key]) !== JSON.stringify(replay[key])) {
        diverged.push(key);
      }
    }

    return diverged;
  }
}

// ---------------------------------------------------------------------------
// CausalGraphBuilder
// ---------------------------------------------------------------------------

/**
 * Builds a causal graph from trace events and explicit causal links.
 * Used to verify that failure injection does not corrupt causal chains.
 */
export class CausalGraphBuilder {
  private links: CausalLink[] = [];

  /**
   * Record an explicit causal link between two events.
   */
  addLink(causeEventId: string, effectEventId: string, reason: string): void {
    this.links.push({ causeEventId, effectEventId, reason });
  }

  /**
   * Build the causal graph from a set of trace events and the registered links.
   */
  build(events: TraceEvent[]): CausalGraph {
    const nodes = new Map<string, TraceEvent>();
    for (const event of events) {
      nodes.set(event.id, event);
    }

    // Derive implicit causal links from parentSpanId relationships
    const implicitLinks: CausalLink[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.parentSpanId) {
        // Find the most recent event with the parent span ID that appears
        // BEFORE this event in the event array (index-based ordering is
        // more reliable than timestamp comparison when events are fast)
        const parentEvent = events
          .slice(0, i)
          .filter(
            (e) =>
              e.spanId === event.parentSpanId &&
              e.id !== event.id
          )
          .at(-1); // last matching event before current index
        if (parentEvent) {
          implicitLinks.push({
            causeEventId: parentEvent.id,
            effectEventId: event.id,
            reason: "parent-span",
          });
        }
      }
    }

    const allLinks = [...implicitLinks, ...this.links];

    // Find root events (no incoming causal links)
    const hasIncoming = new Set(allLinks.map((l) => l.effectEventId));
    const roots = events
      .filter((e) => !hasIncoming.has(e.id))
      .map((e) => e.id);

    return {
      runId: events[0]?.runId ?? "unknown",
      nodes,
      links: allLinks,
      roots,
    };
  }

  /**
   * Verify the integrity of a causal graph.
   */
  verify(graph: CausalGraph): CausalIntegrityResult {
    const { nodes, links, roots } = graph;

    // Check for orphaned events (not reachable from any root via causal links)
    const reachable = new Set<string>(roots);
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of links) {
        if (reachable.has(link.causeEventId) && !reachable.has(link.effectEventId)) {
          reachable.add(link.effectEventId);
          changed = true;
        }
      }
    }

    const orphanedEvents = Array.from(nodes.keys()).filter(
      (id) => !reachable.has(id)
    );

    // Check for cycles using DFS
    const cyclicEvents: string[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (inStack.has(nodeId)) {
        cyclicEvents.push(nodeId);
        return true;
      }
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      inStack.add(nodeId);

      const outgoing = links.filter((l) => l.causeEventId === nodeId);
      for (const link of outgoing) {
        if (hasCycle(link.effectEventId)) return true;
      }

      inStack.delete(nodeId);
      return false;
    };

    // Start DFS from roots first, then from any unvisited nodes
    // (handles cases where all nodes are in a cycle and there are no roots)
    for (const root of roots) {
      hasCycle(root);
    }
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        hasCycle(nodeId);
      }
    }

    const isAcyclic = cyclicEvents.length === 0;
    const allEventsHaveCause =
      orphanedEvents.length === 0 || roots.length === nodes.size;

    return {
      runId: graph.runId,
      allEventsHaveCause,
      isAcyclic,
      orphanedEvents,
      cyclicEvents,
      passed: isAcyclic && orphanedEvents.length === 0,
    };
  }
}
