/**
 * Phase 6 (P1) — Rollback Decision Engine
 *
 * Hybrid auto/manual rollback decision system.
 * Consumes signals from governance monitoring, circuit breakers,
 * replay divergence, and memory drift to produce rollback recommendations.
 */

export type RollbackScope = "execution" | "tenant" | "service" | "global";
export type RollbackDecisionType = "automatic" | "manual_recommended" | "none";

export interface RollbackSignals {
  /** Current error rate as a fraction (0-1) */
  errorRate: number;
  /** Baseline error rate for comparison */
  baselineErrorRate: number;
  /** Governance instability score (0-1, from GovernanceMonitor) */
  governanceInstabilityScore: number;
  /** Replay divergence score (0-1, from LiveReplayDebugger) */
  replayDivergenceScore: number;
  /** Memory drift score (0-1, from MemoryReplayValidator) */
  memoryDriftScore: number;
  /** Whether any circuit breaker is currently open */
  circuitBreakerOpen: boolean;
}

export interface RollbackDecision {
  decisionType: RollbackDecisionType;
  scope: RollbackScope;
  targetId?: string;
  confidence: number;
  reasons: string[];
  suggestedAction: string;
  timestamp: string;
}

/** Thresholds for automatic vs manual rollback triggers. */
const ROLLBACK_THRESHOLDS = {
  autoRollback: {
    errorRateMultiplier: 3.0,       // 3x baseline triggers auto rollback
    governanceInstability: 0.8,
    replayDivergence: 0.5,
    memoryDrift: 0.4,
  },
  manualRecommended: {
    errorRateMultiplier: 1.5,       // 1.5x baseline triggers recommendation
    governanceInstability: 0.5,
    replayDivergence: 0.2,
    memoryDrift: 0.2,
  },
};

export class RollbackDecisionEngine {
  private readonly decisionHistory: RollbackDecision[] = [];

  /**
   * Evaluate current signals and produce a rollback decision.
   * The engine is purely advisory — it does not perform the rollback itself.
   */
  evaluate(signals: RollbackSignals, scope: RollbackScope = "global", targetId?: string): RollbackDecision {
    const reasons: string[] = [];
    let autoScore = 0;
    let manualScore = 0;

    // Error rate analysis
    if (signals.baselineErrorRate > 0) {
      const multiplier = signals.errorRate / signals.baselineErrorRate;
      if (multiplier >= ROLLBACK_THRESHOLDS.autoRollback.errorRateMultiplier) {
        reasons.push(`Error rate ${(multiplier).toFixed(1)}x above baseline (auto threshold: ${ROLLBACK_THRESHOLDS.autoRollback.errorRateMultiplier}x)`);
        autoScore++;
      } else if (multiplier >= ROLLBACK_THRESHOLDS.manualRecommended.errorRateMultiplier) {
        reasons.push(`Error rate ${(multiplier).toFixed(1)}x above baseline (warning threshold: ${ROLLBACK_THRESHOLDS.manualRecommended.errorRateMultiplier}x)`);
        manualScore++;
      }
    }

    // Governance instability
    if (signals.governanceInstabilityScore >= ROLLBACK_THRESHOLDS.autoRollback.governanceInstability) {
      reasons.push(`Governance instability score ${signals.governanceInstabilityScore.toFixed(2)} exceeds auto threshold`);
      autoScore++;
    } else if (signals.governanceInstabilityScore >= ROLLBACK_THRESHOLDS.manualRecommended.governanceInstability) {
      reasons.push(`Governance instability score ${signals.governanceInstabilityScore.toFixed(2)} elevated`);
      manualScore++;
    }

    // Replay divergence
    if (signals.replayDivergenceScore >= ROLLBACK_THRESHOLDS.autoRollback.replayDivergence) {
      reasons.push(`Replay divergence score ${signals.replayDivergenceScore.toFixed(2)} exceeds auto threshold`);
      autoScore++;
    } else if (signals.replayDivergenceScore >= ROLLBACK_THRESHOLDS.manualRecommended.replayDivergence) {
      reasons.push(`Replay divergence score ${signals.replayDivergenceScore.toFixed(2)} elevated`);
      manualScore++;
    }

    // Memory drift
    if (signals.memoryDriftScore >= ROLLBACK_THRESHOLDS.autoRollback.memoryDrift) {
      reasons.push(`Memory drift score ${signals.memoryDriftScore.toFixed(2)} exceeds auto threshold`);
      autoScore++;
    } else if (signals.memoryDriftScore >= ROLLBACK_THRESHOLDS.manualRecommended.memoryDrift) {
      reasons.push(`Memory drift score ${signals.memoryDriftScore.toFixed(2)} elevated`);
      manualScore++;
    }

    // Circuit breaker
    if (signals.circuitBreakerOpen) {
      reasons.push("Circuit breaker is open — execution is already contained");
      autoScore++;
    }

    // Decision
    let decisionType: RollbackDecisionType;
    let confidence: number;
    let suggestedAction: string;

    if (autoScore >= 2) {
      decisionType = "automatic";
      confidence = Math.min(0.95, 0.5 + autoScore * 0.15);
      suggestedAction = `Initiate immediate ${scope}-level rollback${targetId ? ` for '${targetId}'` : ""}. Activate GLOBAL_EXECUTION_PAUSE kill-switch, preserve memory state, and replay last known good state.`;
    } else if (manualScore >= 1 || autoScore >= 1) {
      decisionType = "manual_recommended";
      confidence = Math.min(0.75, 0.3 + (autoScore + manualScore) * 0.1);
      suggestedAction = `Manual review recommended for ${scope}-level rollback${targetId ? ` for '${targetId}'` : ""}. Monitor for 15 minutes before deciding.`;
    } else {
      decisionType = "none";
      confidence = 0.9;
      suggestedAction = "No rollback action required. Continue monitoring.";
    }

    const decision: RollbackDecision = {
      decisionType,
      scope,
      targetId,
      confidence,
      reasons,
      suggestedAction,
      timestamp: new Date().toISOString(),
    };

    this.decisionHistory.push(decision);
    return decision;
  }

  /** Get recent rollback decisions for audit purposes. */
  getHistory(limit = 50): RollbackDecision[] {
    return this.decisionHistory.slice(-limit);
  }
}

/** Singleton rollback decision engine. */
export const rollbackEngine = new RollbackDecisionEngine();
