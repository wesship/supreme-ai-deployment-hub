/**
 * Phase 5 (P1) — Cost-Per-Decision Telemetry
 *
 * Makes governance economically visible by tracking the computational
 * cost of every arbitration, execution path, memory retrieval, and replay.
 *
 * Answers the critical question: "Is intelligence becoming too expensive to maintain?"
 */

export type CostCategory =
  | "arbitration"
  | "execution_step"
  | "memory_retrieval"
  | "replay_reconstruction"
  | "tool_call";

export interface CostEvent {
  eventId: string;
  executionId: string;
  tenantId: string;
  category: CostCategory;
  /** Computational cost in normalized cost units (NCU). 1 NCU = 1ms CPU time. */
  costNcu: number;
  /** Wall-clock latency in ms */
  latencyMs: number;
  timestamp: number;
}

export interface CostSummary {
  tenantId: string;
  windowMs: number;
  totalCostNcu: number;
  costByCategory: Record<CostCategory, number>;
  /** Average cost per decision (arbitration event) */
  costPerDecisionNcu: number;
  /** Cost efficiency: execution steps completed per NCU */
  efficiencyScore: number;
  /** Whether intelligence cost is exceeding sustainable threshold */
  isCostCritical: boolean;
}

/** Threshold above which governance is considered economically unsustainable. */
const COST_CRITICAL_THRESHOLD_NCU_PER_DECISION = 500;

export class CostTelemetryCollector {
  private readonly windowMs: number;
  private readonly events: CostEvent[] = [];

  constructor(windowMs = 300_000) {
    this.windowMs = windowMs;
  }

  /** Record a cost event. */
  record(event: CostEvent): void {
    this.events.push(event);
    this.pruneWindow();
  }

  /** Compute cost summary for a specific tenant over the observation window. */
  getSummary(tenantId: string): CostSummary {
    this.pruneWindow();
    const tenantEvents = this.events.filter((e) => e.tenantId === tenantId);

    const costByCategory: Record<CostCategory, number> = {
      arbitration: 0,
      execution_step: 0,
      memory_retrieval: 0,
      replay_reconstruction: 0,
      tool_call: 0,
    };

    let totalCostNcu = 0;
    for (const event of tenantEvents) {
      costByCategory[event.category] += event.costNcu;
      totalCostNcu += event.costNcu;
    }

    const arbitrationEvents = tenantEvents.filter((e) => e.category === "arbitration");
    const executionSteps = tenantEvents.filter((e) => e.category === "execution_step");

    const costPerDecisionNcu =
      arbitrationEvents.length > 0
        ? costByCategory.arbitration / arbitrationEvents.length
        : 0;

    const efficiencyScore =
      totalCostNcu > 0 ? executionSteps.length / totalCostNcu : 0;

    return {
      tenantId,
      windowMs: this.windowMs,
      totalCostNcu,
      costByCategory,
      costPerDecisionNcu,
      efficiencyScore,
      isCostCritical: costPerDecisionNcu > COST_CRITICAL_THRESHOLD_NCU_PER_DECISION,
    };
  }

  /** Get the top N most expensive executions in the current window. */
  getTopExpensiveExecutions(n = 10): Array<{ executionId: string; totalCostNcu: number }> {
    this.pruneWindow();
    const byExecution = new Map<string, number>();
    for (const event of this.events) {
      byExecution.set(event.executionId, (byExecution.get(event.executionId) ?? 0) + event.costNcu);
    }
    return [...byExecution.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([executionId, totalCostNcu]) => ({ executionId, totalCostNcu }));
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.events.length > 0 && this.events[0].timestamp < cutoff) {
      this.events.shift();
    }
  }
}

/** Singleton cost telemetry collector. */
export const costTelemetry = new CostTelemetryCollector();
